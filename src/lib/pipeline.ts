import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "./crypto";
import { db, schema } from "./db";
import { env } from "./env";
import { HttpError } from "./http";
import * as github from "./integrations/github";
import { getOrCreateNeonProject, runSchema } from "./integrations/neon";
import { getIntegration } from "./integrations/store";
import * as vercel from "./integrations/vercel";
import {
  currentGeneration,
  latestBuild,
  projectDeployment,
  requireGitHubToken,
  requireRepo,
  updateProject,
} from "./projects";
import { appSpecSchema, type AppSpec } from "./spec";
import { slugify, workflowFile } from "./templates";

export async function approveSpec(project: schema.Project, edited?: AppSpec) {
  const spec = edited ? appSpecSchema.parse(edited) : project.spec;
  if (!spec) throw new HttpError(400, "ابتدا نیازمندی‌ها را تولید کنید.");
  const forced = project.kind === "app" ? project.needsCloud : null;
  if (forced !== null) spec.needsBackend = forced;
  try {
    await db().execute(sql`select approve_project_requirements(${project.id}::uuid,${JSON.stringify(spec)}::jsonb)`);
  } catch (error) {
    const cause = error instanceof Error ? (error as Error & { cause?: Error }).cause : undefined;
    if (String(error).includes("workflow_active") || String(cause).includes("workflow_active"))
      throw new HttpError(409, "تیم هوش مصنوعی در حال کار روی این پروژه است.");
    throw error;
  }
  const [updated] = await db().select().from(schema.projects).where(eq(schema.projects.id, project.id));
  return updated!;
}

// ---------------------------------------------------------------- github

/** Creates the repository on first push, then commits the current snapshot. */
export async function pushToGitHub(user: schema.User, project: schema.Project, message?: string) {
  const generation = await currentGeneration(project);
  if (!generation?.files?.length) throw new HttpError(400, "ابتدا کد اپلیکیشن را تولید کنید.");
  const token = await requireGitHubToken(user.id);

  let owner = project.githubOwner;
  let repoName = project.githubRepo;
  if (!owner || !repoName) {
    const repo = await github.createRepository(token, project.slug, project.spec?.summary ?? project.idea);
    owner = repo.owner;
    repoName = repo.name;
    project = await updateProject(project.id, {
      githubOwner: repo.owner,
      githubRepo: repo.name,
      githubRepoId: repo.id,
    });
  }

  const commitSha = await github.commitSnapshot(
    token,
    { owner, name: repoName, branch: "main" },
    generation.files,
    message ?? `feat: ${generation.kind === "fix" ? "AI build fix" : "AI generated app"} (${generation.provider})`,
  );
  await db().insert(schema.buildJobs).values({ projectId: project.id, commitSha, trigger: "push" });
  return updateProject(project.id, {
    status: "pushed",
    lastCommitSha: commitSha,
    lastError: null,
  });
}

// ----------------------------------------------------------------- build

export async function syncBuild(user: schema.User, project: schema.Project) {
  const build = await latestBuild(project.id);
  if (!build || !project.githubOwner || !project.githubRepo) return build;
  if (build.status === "completed" && (build.conclusion !== "success" || build.releaseAssetId || build.artifactId)) {
    return build;
  }
  const token = await requireGitHubToken(user.id);
  const { owner, repo } = requireRepo(project);

  const run = build.runId
    ? await github.getWorkflowRun(token, owner, repo, build.runId)
    : await github.findWorkflowRun(
        token,
        owner,
        repo,
        workflowFile(project.template),
        build.commitSha,
        build.createdAt,
      );
  if (!run) return build;

  const update: Partial<schema.BuildJob> = {
    runId: run.id,
    runNumber: run.run_number,
    runUrl: run.html_url,
    status: run.status,
    conclusion: run.conclusion,
    updatedAt: new Date(),
  };

  if (run.status === "completed" && run.conclusion === "success" && project.template !== "web") {
    const [asset, artifact] = await Promise.all([
      github.findReleaseApk(token, owner, repo, `build-${run.run_number}`),
      github.findRunArtifact(token, owner, repo, run.id),
    ]);
    update.releaseAssetId = asset?.id ?? null;
    update.artifactId = artifact?.id ?? null;
    update.apkName = asset?.name ?? `${project.slug}.apk`;
    update.apkSizeBytes = asset?.size ?? artifact?.size_in_bytes ?? null;
  } else if (run.status === "completed" && run.conclusion === "failure") {
    update.failureLog = await github.failedJobLog(token, owner, repo, run.id).catch(() => null);
  }

  const [updated] = await db()
    .update(schema.buildJobs)
    .set(update)
    .where(eq(schema.buildJobs.id, build.id))
    .returning();
  return updated!;
}

export async function rebuild(user: schema.User, project: schema.Project) {
  const { owner, repo } = requireRepo(project);
  if (!project.lastCommitSha) throw new HttpError(400, "هنوز کدی در GitHub ثبت نشده است.");
  const token = await requireGitHubToken(user.id);
  await github.dispatchWorkflow(token, owner, repo, workflowFile(project.template), "main");
  await db().insert(schema.buildJobs).values({
    projectId: project.id,
    commitSha: project.lastCommitSha,
    trigger: "dispatch",
  });
}

export async function downloadApkUrl(user: schema.User, project: schema.Project) {
  const build = await latestBuild(project.id);
  if (!build || build.conclusion !== "success") throw new HttpError(404, "هنوز APK موفقی ساخته نشده است.");
  const { owner, repo } = requireRepo(project);
  const token = await requireGitHubToken(user.id);
  if (build.releaseAssetId) return github.releaseAssetDownloadUrl(token, owner, repo, build.releaseAssetId);
  if (build.artifactId) return github.artifactDownloadUrl(token, owner, repo, build.artifactId);
  throw new HttpError(404, "فایل APK برای این Build پیدا نشد.");
}

/**
 * Atomically claims the cloud deployment for one project.
 *
 * The unique projectId index ensures that only one request can create
 * the initial deployment row. Failed deployments can be claimed again,
 * but only by one concurrent retry.
 */
async function claimCloudDeployment(projectId: string) {
  const [created] = await db()
    .insert(schema.deployments)
    .values({
      projectId,
      status: "provisioning",
      error: null,
    })
    .onConflictDoNothing({
      target: schema.deployments.projectId,
    })
    .returning();

  // First request owns the newly inserted row.
  if (created) return created;

  // A row already exists. Only failed deployments are retryable.
  const existing = await projectDeployment(projectId);

  if (!existing) {
    throw new HttpError(409, "وضعیت زیرساخت پروژه قابل تشخیص نیست؛ دوباره تلاش کنید.");
  }

  if (existing.status !== "failed") {
    throw new HttpError(409, "عملیات زیرساخت این پروژه قبلاً شروع شده یا تکمیل شده است.");
  }

  // Compare-and-set: only one concurrent request can change failed -> provisioning.
  const [claimed] = await db()
    .update(schema.deployments)
    .set({
      status: "provisioning",
      error: null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.deployments.id, existing.id), eq(schema.deployments.status, "failed")))
    .returning();

  if (!claimed) {
    throw new HttpError(409, "درخواست دیگری در حال شروع مجدد زیرساخت این پروژه است.");
  }

  return claimed;
}
// ----------------------------------------------------------------- cloud

/**
 * Optional cloud backend: Neon database + Vercel project linked to the repo.
 * The Vercel production URL is later written to the repo variable API_URL so
 * the next APK build talks to the backend.
 */
export async function provisionCloud(user: schema.User, project: schema.Project) {
  const { owner, repo } = requireRepo(project);
  if (!project.githubRepoId) throw new HttpError(400, "شناسه Repository ثبت نشده است.");
  const generation = await currentGeneration(project);
  const vercelAuth = await getIntegration(user.id, "vercel");
  if (!vercelAuth) throw new HttpError(400, "ابتدا توکن Vercel را در صفحه تنظیمات وارد کنید.");
  const teamId = vercelAuth.metadata.teamId || undefined;

  const deployment = await claimCloudDeployment(project.id);
  try {
    let databaseUrl: string | null = deployment!.encryptedDatabaseUrl
      ? decryptSecret(deployment!.encryptedDatabaseUrl)
      : null;

    let neonProjectId = deployment!.neonProjectId;

    if (project.spec?.needsBackend) {
      const neonAuth = await getIntegration(user.id, "neon");

      const neonKey = neonAuth?.secret ?? env.neonApiKey();

      if (!neonKey) {
        throw new HttpError(400, "کلید API نئون تنظیم نشده است (در صفحه تنظیمات وارد کنید).");
      }

      /*
       * A deterministic name is essential:
       * if Neon creates the project but the local DB write fails,
       * the next attempt can find the same Neon project.
       *
       * UUID prevents collisions between different Idea2App projects.
       */
      if (!databaseUrl || !neonProjectId) {
        const neonProjectName = `idea2app-${project.id}`;

        const neonProject = await getOrCreateNeonProject(
          neonKey,
          neonProjectName,
          neonAuth ? neonAuth.metadata.orgId || undefined : env.neonOrgId(),
        );

        databaseUrl = neonProject.connectionUri;
        neonProjectId = neonProject.projectId;

        /*
         * Persist the Neon resource immediately.
         * This must happen before schema execution and Vercel deployment.
         */
        await db()
          .update(schema.deployments)
          .set({
            neonProjectId,
            encryptedDatabaseUrl: encryptSecret(databaseUrl),
            updatedAt: new Date(),
          })
          .where(eq(schema.deployments.id, deployment!.id));
      }

      /*
       * schema.sql is required to be idempotent by BACKEND_RULES
       * in src/lib/ai/prompts.ts.
       *
       * Running it again makes provisioning recoverable after
       * a previous partial failure.
       */
      const schemaSql = generation?.files?.find((file) => file.path === "db/schema.sql")?.content;

      if (schemaSql && databaseUrl) {
        await runSchema(databaseUrl, schemaSql);
      }
    }

    const hasWeb = project.template !== "expo";
    const vercelProject = deployment!.vercelProjectId
      ? await vercel.getVercelProject(vercelAuth.secret, teamId, deployment!.vercelProjectId)
      : await vercel.createVercelProject(vercelAuth.secret, teamId, {
          name: slugify(project.slug),
          repoFullName: `${owner}/${repo}`,
          framework: hasWeb ? "vite" : null,
          buildCommand: hasWeb ? undefined : "echo 'API only'",
          outputDirectory: hasWeb ? undefined : "public",
        });
    await db()
      .update(schema.deployments)
      .set({ vercelProjectId: vercelProject.id })
      .where(eq(schema.deployments.id, deployment!.id));

    if (databaseUrl) await vercel.upsertEnv(vercelAuth.secret, teamId, vercelProject.id, "DATABASE_URL", databaseUrl);
    const vercelDeployment = await vercel.deployFromGit(
      vercelAuth.secret,
      teamId,
      vercelProject.name,
      project.githubRepoId,
      "main",
    );

    await db()
      .update(schema.deployments)
      .set({
        vercelProjectId: vercelProject.id,
        vercelDeploymentId: vercelDeployment.id,
        status: "deploying",
        updatedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deployment!.id));
  } catch (error) {
    await db()
      .update(schema.deployments)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deployment!.id));
    throw error;
  }
}

/** Polls Vercel; once live, wires API_URL into the repo and rebuilds the APK. */
export async function syncDeployment(user: schema.User, project: schema.Project) {
  const deployment = await projectDeployment(project.id);
  if (!deployment || deployment.status !== "deploying" || !deployment.vercelDeploymentId) return deployment;
  const vercelAuth = await getIntegration(user.id, "vercel");
  if (!vercelAuth) return deployment;

  const state = await vercel.getDeployment(
    vercelAuth.secret,
    vercelAuth.metadata.teamId || undefined,
    deployment.vercelDeploymentId,
  );
  if (state.readyState === "ERROR" || state.readyState === "CANCELED") {
    const [updated] = await db()
      .update(schema.deployments)
      .set({
        status: "failed",
        error: state.errorMessage ?? "Vercel deployment failed",
        updatedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deployment.id))
      .returning();
    return updated!;
  }
  if (state.readyState !== "READY" || !state.productionUrl) return deployment;

  const [updated] = await db()
    .update(schema.deployments)
    .set({ status: "ready", url: state.productionUrl, updatedAt: new Date() })
    .where(eq(schema.deployments.id, deployment.id))
    .returning();
  await connectBackendUrl(user, project, state.productionUrl);
  return updated!;
}

/**
 * Points an Android app at its live backend: the APK reads API_URL at build
 * time, so the repository variable is set and the APK rebuilt. Websites call
 * their own /api and need nothing.
 */
export async function connectBackendUrl(user: schema.User, project: schema.Project, url: string) {
  if (project.kind !== "app" || !project.spec?.needsBackend) return;
  const { owner, repo } = requireRepo(project);
  const token = await requireGitHubToken(user.id);
  await github.setRepositoryVariable(token, owner, repo, "API_URL", url);
  await rebuild(user, project);
}
