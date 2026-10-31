import { eq } from "drizzle-orm";
import { generateStructured, isAiProvider, type AiProviderId } from "./ai";
import { imagesOf } from "./attachments";
import { SPEC_SYSTEM, codeOutputSchema, codePrompt, codeSystemPrompt, fixPrompt, specPrompt } from "./ai/prompts";
import { decryptSecret, encryptSecret } from "./crypto";
import { db, schema } from "./db";
import { env } from "./env";
import { HttpError } from "./http";
import * as github from "./integrations/github";
import { createNeonProject, runSchema } from "./integrations/neon";
import { getIntegration } from "./integrations/store";
import * as vercel from "./integrations/vercel";
import {
  currentGeneration,
  latestBuild,
  projectAgent,
  projectDeployment,
  requireGitHubToken,
  requireRepo,
  updateProject,
} from "./projects";
import { appSpecSchema, type AppSpec } from "./spec";
import { renderProject, slugify, workflowFile } from "./templates";

const GENERATION_LOCK_MS = 6 * 60_000;

function providerOf(project: schema.Project, override?: string): AiProviderId {
  const provider = override ?? project.aiProvider;
  if (!isAiProvider(provider)) throw new HttpError(400, "ارائه‌دهنده هوش مصنوعی نامعتبر است.");
  return provider;
}

function assertNotBusy(project: schema.Project) {
  if (project.status === "generating" && Date.now() - project.updatedAt.getTime() < GENERATION_LOCK_MS) {
    throw new HttpError(409, "یک عملیات تولید برای این پروژه در حال اجراست. چند لحظه صبر کنید.");
  }
}

async function startJob(projectId: string, kind: "spec" | "code" | "fix", provider: string) {
  const [job] = await db()
    .insert(schema.generationJobs)
    .values({ projectId, kind, provider, model: "pending" })
    .returning();
  return job!;
}

async function failJob(jobId: string, projectId: string, error: unknown, restoreStatus: schema.Project["status"]) {
  const message = error instanceof Error ? error.message : String(error);
  await db()
    .update(schema.generationJobs)
    .set({ status: "failed", error: message, finishedAt: new Date() })
    .where(eq(schema.generationJobs.id, jobId));
  await updateProject(projectId, { status: restoreStatus, lastError: message });
}

// ------------------------------------------------------------------ spec

export async function generateSpec(user: schema.User, project: schema.Project, feedback?: string, providerOverride?: string) {
  assertNotBusy(project);
  const provider = providerOf(project, providerOverride);
  const previousStatus = project.status;
  const job = await startJob(project.id, "spec", provider);
  await updateProject(project.id, { status: "generating", lastError: null });

  try {
    const { data, model } = await generateStructured({
      userId: user.id,
      projectId: project.id,
      provider,
      purpose: "spec",
      system: SPEC_SYSTEM,
      prompt: specPrompt(project.idea, specContext(project), feedback, project.spec ?? undefined, project.attachments),
      images: imagesOf(project.attachments),
      schema: appSpecSchema,
      maxOutputTokens: 8000,
    });
    await db()
      .update(schema.generationJobs)
      .set({ status: "succeeded", model, finishedAt: new Date() })
      .where(eq(schema.generationJobs.id, job.id));
    // The user's own choice (phone-only vs cloud) wins over the model's guess.
    const forced = specContext(project).backend;
    if (forced !== null) data.needsBackend = forced;
    return updateProject(project.id, {
      spec: data,
      name: data.appName,
      status: "spec_ready",
      specApprovedAt: null,
    });
  } catch (error) {
    await failJob(job.id, project.id, error, previousStatus === "generating" ? "draft" : previousStatus);
    throw error;
  }
}

/** Apps follow the user's phone-only / cloud choice; websites let the AI decide. */
function specContext(project: schema.Project) {
  return {
    kind: project.kind,
    backend: project.kind === "app" ? project.needsCloud : null,
  } as const;
}

export async function approveSpec(project: schema.Project, edited?: AppSpec) {
  const spec = edited ? appSpecSchema.parse(edited) : project.spec;
  if (!spec) throw new HttpError(400, "ابتدا نیازمندی‌ها را تولید کنید.");
  const forced = specContext(project).backend;
  if (forced !== null) spec.needsBackend = forced;
  return updateProject(project.id, {
    spec,
    name: spec.appName,
    specApprovedAt: new Date(),
    status: project.status === "spec_ready" || project.status === "draft" ? "spec_approved" : project.status,
  });
}

// ------------------------------------------------------------------ code

async function saveGeneration(
  project: schema.Project,
  jobId: string,
  model: string,
  spec: AppSpec,
  aiFiles: { path: string; content: string }[],
  libraries: string[],
  notes: string,
) {
  const rendered = renderProject({
    template: project.template,
    slug: project.slug,
    spec,
    aiFiles,
    requestedLibraries: libraries,
  });
  await db()
    .update(schema.generationJobs)
    .set({
      status: "succeeded",
      model,
      files: rendered.files,
      aiFiles,
      libraries,
      warnings: rendered.warnings,
      notes,
      finishedAt: new Date(),
    })
    .where(eq(schema.generationJobs.id, jobId));
  return updateProject(project.id, { currentGenerationId: jobId, status: "generated", lastError: null });
}

export async function generateCode(user: schema.User, project: schema.Project, providerOverride?: string) {
  assertNotBusy(project);
  if (!project.spec || !project.specApprovedAt) {
    throw new HttpError(400, "ابتدا نیازمندی‌ها را تأیید کنید.");
  }
  const spec = project.spec;
  const provider = providerOf(project, providerOverride);
  const previousStatus = project.status;
  const job = await startJob(project.id, "code", provider);
  await updateProject(project.id, { status: "generating", lastError: null });

  try {
    const { data, model } = await generateStructured({
      userId: user.id,
      projectId: project.id,
      provider,
      purpose: "code",
      system: codeSystemPrompt(project.template, spec.needsBackend),
      prompt: codePrompt(spec),
      schema: codeOutputSchema,
      maxOutputTokens: 64000,
    });
    return await saveGeneration(project, job.id, model, spec, data.files, data.libraries, data.notes);
  } catch (error) {
    await failJob(job.id, project.id, error, previousStatus === "generating" ? "spec_approved" : previousStatus);
    throw error;
  }
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
  return updateProject(project.id, { status: "pushed", lastCommitSha: commitSha, lastError: null });
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
    : await github.findWorkflowRun(token, owner, repo, workflowFile(project.template), build.commitSha, build.createdAt);
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
  await db()
    .insert(schema.buildJobs)
    .values({ projectId: project.id, commitSha: project.lastCommitSha, trigger: "dispatch" });
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

// ------------------------------------------------------------------- fix

/** Sends the failed build log to the AI, re-renders the project and pushes the fix. */
export async function autoFix(user: schema.User, project: schema.Project, providerOverride?: string) {
  assertNotBusy(project);
  // The failure can come from the GitHub Actions build or from the VPS deploy.
  const build = await syncBuild(user, project);
  const agent = await projectAgent(project.id);
  let failureLog: string;
  let label: string;
  if (build?.conclusion === "failure") {
    failureLog = build.failureLog ?? "(log unavailable)";
    label = `failed build #${build.runNumber ?? ""}`.trim();
  } else if (agent?.status === "error" && agent.lastLog) {
    failureLog = agent.lastLog;
    label = "failed VPS deploy";
  } else {
    throw new HttpError(400, "خطای فعالی برای اصلاح وجود ندارد.");
  }
  const generation = await currentGeneration(project);
  if (!generation?.files || !generation.aiFiles || !project.spec) throw new HttpError(400, "کد قبلی پیدا نشد.");

  const spec = project.spec;
  const provider = providerOf(project, providerOverride);
  const editable = new Set(generation.aiFiles.map((f) => f.path));
  const job = await startJob(project.id, "fix", provider);
  await updateProject(project.id, { status: "generating", lastError: null });

  try {
    const { data, model } = await generateStructured({
      userId: user.id,
      projectId: project.id,
      provider,
      purpose: "fix",
      system: codeSystemPrompt(project.template, spec.needsBackend),
      prompt: fixPrompt(spec, generation.files, failureLog, editable),
      schema: codeOutputSchema,
      maxOutputTokens: 64000,
    });
    const merged = new Map(generation.aiFiles.map((f) => [f.path, f]));
    for (const file of data.files) merged.set(file.path, file);
    const libraries = data.libraries.length ? data.libraries : (generation.libraries ?? []);
    const updated = await saveGeneration(project, job.id, model, spec, [...merged.values()], libraries, data.notes);
    return await pushToGitHub(user, updated, `fix: AI repair of ${label}`);
  } catch (error) {
    await failJob(job.id, project.id, error, "pushed");
    throw error;
  }
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

  const existing = await projectDeployment(project.id);
  if (existing && existing.status !== "failed") {
    throw new HttpError(409, "زیرساخت ابری این پروژه قبلاً ساخته شده است.");
  }
  const [deployment] = existing
    ? await db()
        .update(schema.deployments)
        .set({ status: "provisioning", error: null, updatedAt: new Date() })
        .where(eq(schema.deployments.id, existing.id))
        .returning()
    : await db().insert(schema.deployments).values({ projectId: project.id }).returning();

  try {
    let databaseUrl: string | null = deployment!.encryptedDatabaseUrl
      ? decryptSecret(deployment!.encryptedDatabaseUrl)
      : null;
    let neonProjectId = deployment!.neonProjectId;

    if (project.spec?.needsBackend && !databaseUrl) {
      const neonAuth = await getIntegration(user.id, "neon");
      const neonKey = neonAuth?.secret ?? env.neonApiKey();
      if (!neonKey) throw new HttpError(400, "کلید API نئون تنظیم نشده است (در صفحه تنظیمات وارد کنید).");
      const neonProject = await createNeonProject(
        neonKey,
        project.slug,
        neonAuth ? neonAuth.metadata.orgId || undefined : env.neonOrgId(),
      );
      databaseUrl = neonProject.connectionUri;
      neonProjectId = neonProject.projectId;
      await db()
        .update(schema.deployments)
        .set({ neonProjectId, encryptedDatabaseUrl: encryptSecret(databaseUrl) })
        .where(eq(schema.deployments.id, deployment!.id));

      const schemaSql = generation?.files?.find((f) => f.path === "db/schema.sql")?.content;
      if (schemaSql) await runSchema(databaseUrl, schemaSql);
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
      .set({ status: "failed", error: error instanceof Error ? error.message : String(error), updatedAt: new Date() })
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

  const state = await vercel.getDeployment(vercelAuth.secret, vercelAuth.metadata.teamId || undefined, deployment.vercelDeploymentId);
  if (state.readyState === "ERROR" || state.readyState === "CANCELED") {
    const [updated] = await db()
      .update(schema.deployments)
      .set({ status: "failed", error: state.errorMessage ?? "Vercel deployment failed", updatedAt: new Date() })
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
