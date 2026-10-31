import { and, desc, eq } from "drizzle-orm";
import { attachmentSummary } from "./attachments";
import { db, schema } from "./db";
import { HttpError } from "./http";
import { getIntegration } from "./integrations/store";

export async function getOwnedProject(userId: string, projectId: string): Promise<schema.Project> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) throw new HttpError(404, "پروژه پیدا نشد.");
  const [project] = await db()
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!project) throw new HttpError(404, "پروژه پیدا نشد.");
  return project;
}

export async function updateProject(projectId: string, values: Partial<schema.Project>) {
  const [project] = await db()
    .update(schema.projects)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId))
    .returning();
  return project!;
}

export async function currentGeneration(project: schema.Project) {
  if (!project.currentGenerationId) return null;
  const [job] = await db()
    .select()
    .from(schema.generationJobs)
    .where(eq(schema.generationJobs.id, project.currentGenerationId))
    .limit(1);
  return job ?? null;
}

export async function latestBuild(projectId: string) {
  const [build] = await db()
    .select()
    .from(schema.buildJobs)
    .where(eq(schema.buildJobs.projectId, projectId))
    .orderBy(desc(schema.buildJobs.createdAt))
    .limit(1);
  return build ?? null;
}

export async function projectDeployment(projectId: string) {
  const [deployment] = await db()
    .select()
    .from(schema.deployments)
    .where(eq(schema.deployments.projectId, projectId))
    .limit(1);
  return deployment ?? null;
}

export async function projectAgent(projectId: string) {
  const [agent] = await db()
    .select()
    .from(schema.vpsAgents)
    .where(eq(schema.vpsAgents.projectId, projectId))
    .limit(1);
  return agent ?? null;
}

export async function requireGitHubToken(userId: string): Promise<string> {
  const github = await getIntegration(userId, "github");
  if (!github) throw new HttpError(400, "حساب GitHub متصل نیست. از صفحه «اتصال‌ها و کلیدها» GitHub را وصل کنید.");
  return github.secret;
}

export function requireRepo(project: schema.Project) {
  if (!project.githubOwner || !project.githubRepo) {
    throw new HttpError(400, "ابتدا پروژه را در GitHub ثبت کنید.");
  }
  return { owner: project.githubOwner, repo: project.githubRepo };
}

/** Client-safe project view, used by pages and API responses. */
export async function projectView(project: schema.Project) {
  const [generation, build, deployment, agent] = await Promise.all([
    currentGeneration(project),
    latestBuild(project.id),
    projectDeployment(project.id),
    projectAgent(project.id),
  ]);
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    idea: project.idea,
    attachments: attachmentSummary(project.attachments),
    kind: project.kind,
    template: project.template,
    needsCloud: project.needsCloud,
    hosting: project.hosting,
    vpsProvider: project.vpsProvider,
    aiProvider: project.aiProvider,
    status: project.status,
    spec: project.spec,
    specApprovedAt: project.specApprovedAt?.toISOString() ?? null,
    lastError: project.lastError,
    repo:
      project.githubOwner && project.githubRepo
        ? {
            owner: project.githubOwner,
            name: project.githubRepo,
            url: `https://github.com/${project.githubOwner}/${project.githubRepo}`,
          }
        : null,
    generation: generation
      ? {
          id: generation.id,
          kind: generation.kind,
          provider: generation.provider,
          model: generation.model,
          status: generation.status,
          notes: generation.notes,
          warnings: generation.warnings ?? [],
          files: (generation.files ?? []).map((f) => ({ path: f.path, content: f.content })),
          createdAt: generation.createdAt.toISOString(),
        }
      : null,
    build: build
      ? {
          id: build.id,
          status: build.status,
          conclusion: build.conclusion,
          runUrl: build.runUrl,
          runNumber: build.runNumber,
          apkName: build.apkName,
          apkSizeBytes: build.apkSizeBytes,
          downloadable: Boolean(build.releaseAssetId || build.artifactId),
          commitSha: build.commitSha,
          createdAt: build.createdAt.toISOString(),
        }
      : null,
    deployment: deployment
      ? { status: deployment.status, url: deployment.url, error: deployment.error, hasDatabase: Boolean(deployment.neonProjectId) }
      : null,
    vps: agent
      ? {
          // "pending" until the installer registers; heartbeats arrive every ~2 minutes after that.
          status: agent.secretHash ? agent.status : "pending",
          registered: Boolean(agent.secretHash),
          url: agent.url,
          hostname: agent.hostname,
          ip: agent.ip,
          deployedCommit: agent.deployedCommit,
          lastMessage: agent.lastMessage,
          lastLog: agent.lastLog,
          lastReportAt: agent.lastReportAt?.toISOString() ?? null,
          stale: agent.lastReportAt ? Date.now() - agent.lastReportAt.getTime() > 10 * 60_000 : false,
        }
      : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export type ProjectView = Awaited<ReturnType<typeof projectView>>;
