import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import * as github from "../integrations/github";
import { connectBackendUrl } from "../pipeline";
import { requireGitHubToken, requireRepo } from "../projects";

const REGISTRATION_TTL_MS = 24 * 60 * 60_000;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sameHash(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface InstallInstructions {
  token: string;
  command: string;
  cloudInit: string;
  expiresAt: string;
}

/** The one-line install command and the same thing as a cloud-init / user-data script. */
export function installInstructions(token: string, expiresAt: Date): InstallInstructions {
  const appUrl = env.appUrl();
  const command = `curl -fsSL ${appUrl}/agent/install.sh | sudo IDEA2APP_URL=${appUrl} IDEA2APP_TOKEN=${token} bash`;
  const cloudInit = `#!/bin/bash
# Idea2App AI: installs the deploy agent on the first boot of this server.
curl -fsSL ${appUrl}/agent/install.sh | IDEA2APP_URL=${appUrl} IDEA2APP_TOKEN=${token} bash > /var/log/idea2app-install.log 2>&1
`;
  return { token, command, cloudInit, expiresAt: expiresAt.toISOString() };
}

/**
 * Creates (or renews) the one-time registration token for a project's VPS.
 * Only its hash is stored; the token is shown to the user once.
 */
export async function createRegistration(project: schema.Project): Promise<InstallInstructions> {
  requireRepo(project);
  const token = `i2a_reg_${randomBytes(24).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + REGISTRATION_TTL_MS);
  await db()
    .insert(schema.vpsAgents)
    .values({ projectId: project.id, registrationTokenHash: sha256(token), registrationExpiresAt: expiresAt })
    .onConflictDoUpdate({
      target: schema.vpsAgents.projectId,
      set: { registrationTokenHash: sha256(token), registrationExpiresAt: expiresAt, updatedAt: new Date() },
    });
  return installInstructions(token, expiresAt);
}

export const registerSchema = z.object({
  token: z.string().min(10).max(200),
  publicKey: z
    .string()
    .trim()
    .regex(/^ssh-ed25519 [A-Za-z0-9+/=]+( [^\n]{0,100})?$/, "invalid public key"),
  hostname: z.string().max(100).default(""),
  ip: z.string().max(64).default(""),
});

/** Called by install.sh: trades the one-time token for an agent secret and a deploy key. */
export async function registerAgent(input: z.infer<typeof registerSchema>) {
  const tokenHash = sha256(input.token);
  const [agent] = await db()
    .select()
    .from(schema.vpsAgents)
    .where(eq(schema.vpsAgents.registrationTokenHash, tokenHash))
    .limit(1);
  if (!agent || !agent.registrationExpiresAt || agent.registrationExpiresAt < new Date()) {
    throw new HttpError(401, "توکن نصب نامعتبر یا منقضی است؛ از صفحه پروژه دستور جدید بگیرید.");
  }
  const [project] = await db().select().from(schema.projects).where(eq(schema.projects.id, agent.projectId)).limit(1);
  if (!project) throw new HttpError(404, "پروژه پیدا نشد.");
  const { owner, repo } = requireRepo(project);
  const ghToken = await requireGitHubToken(project.userId);

  if (agent.deployKeyId) await github.deleteDeployKey(ghToken, owner, repo, agent.deployKeyId);
  const title = `idea2app-vps-${(input.hostname || input.ip || "server").replace(/[^A-Za-z0-9.-]/g, "").slice(0, 40)}`;
  const deployKeyId = await github.addDeployKey(ghToken, owner, repo, title, input.publicKey);

  const secret = `i2a_agent_${randomBytes(32).toString("base64url")}`;
  await db()
    .update(schema.vpsAgents)
    .set({
      registrationTokenHash: null,
      registrationExpiresAt: null,
      secretHash: sha256(secret),
      status: "deploying",
      hostname: input.hostname || null,
      ip: input.ip || null,
      deployKeyId,
      lastMessage: "ایجنت نصب شد",
      lastReportAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.vpsAgents.id, agent.id));

  return { secret, repo: `git@github.com:${owner}/${repo}.git`, branch: "main", project: project.name };
}

export const reportSchema = z.object({
  status: z.enum(["deploying", "online", "error"]),
  message: z.string().max(500).default(""),
  commit: z.string().max(64).default(""),
  url: z.string().url().max(300).optional(),
  log: z.string().max(10_000).default(""),
  heartbeat: z.boolean().default(false),
});

/** Called by the agent after each deploy and on every timer tick (heartbeat). */
export async function recordReport(authorization: string | null, input: z.infer<typeof reportSchema>) {
  const secret = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret.startsWith("i2a_agent_")) throw new HttpError(401, "unauthorized");
  const [agent] = await db()
    .select()
    .from(schema.vpsAgents)
    .where(eq(schema.vpsAgents.secretHash, sha256(secret)))
    .limit(1);
  if (!agent?.secretHash || !sameHash(agent.secretHash, sha256(secret))) throw new HttpError(401, "unauthorized");

  const urlChanged = input.status === "online" && input.url && input.url !== agent.url;
  await db()
    .update(schema.vpsAgents)
    .set({
      status: input.status,
      lastMessage: input.message || null,
      lastReportAt: new Date(),
      ...(input.commit && input.status === "online" ? { deployedCommit: input.commit } : {}),
      ...(input.url && input.status === "online" ? { url: input.url } : {}),
      // Heartbeats carry no log; keep the last deploy's log until the next deploy.
      ...(!input.heartbeat && input.log ? { lastLog: input.log } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.vpsAgents.id, agent.id));

  if (urlChanged && input.url) {
    const [project] = await db().select().from(schema.projects).where(eq(schema.projects.id, agent.projectId)).limit(1);
    const [user] = project
      ? await db().select().from(schema.users).where(eq(schema.users.id, project.userId)).limit(1)
      : [];
    if (project && user) await connectBackendUrl(user, project, input.url);
  }
}

/** Removes the deploy key and forgets the server (the server itself is not touched). */
export async function disconnectAgent(project: schema.Project) {
  const [agent] = await db().select().from(schema.vpsAgents).where(eq(schema.vpsAgents.projectId, project.id)).limit(1);
  if (!agent) return;
  if (agent.deployKeyId && project.githubOwner && project.githubRepo) {
    const token = await requireGitHubToken(project.userId);
    await github.deleteDeployKey(token, project.githubOwner, project.githubRepo, agent.deployKeyId);
  }
  await db().delete(schema.vpsAgents).where(eq(schema.vpsAgents.id, agent.id));
}
