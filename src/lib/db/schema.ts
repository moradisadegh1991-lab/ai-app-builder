import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AppSpec } from "../spec";
import type { GeneratedFile } from "../templates/types";

export const integrationProvider = pgEnum("integration_provider", [
  "github",
  "vercel",
  "neon",
  "openai",
  "anthropic",
  "gemini",
]);

export const appTemplate = pgEnum("app_template", ["capacitor", "expo", "web"]);
export const projectKind = pgEnum("project_kind", ["app", "website"]);
// none = runs only on the phone; vps = user's own or a free VPS with the deploy agent; vercel = Vercel + Neon free tiers.
export const hostingTarget = pgEnum("hosting_target", ["none", "vps", "vercel"]);
export const planId = pgEnum("plan_id", ["free", "plus", "pro", "max"]);

export const projectStatus = pgEnum("project_status", [
  "draft",
  "spec_ready",
  "spec_approved",
  "generating",
  "generated",
  "pushed",
  "failed",
]);

export const jobKind = pgEnum("job_kind", ["spec", "code", "fix"]);
export const jobStatus = pgEnum("job_status", ["running", "succeeded", "failed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // Set when the user signs in with, or connects, Google / GitHub (e-mail code login always works too).
  googleId: text("google_id").unique(),
  githubId: bigint("github_id", { mode: "number" }).unique(),
  githubLogin: text("github_login"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  ...timestamps,
});

// One-time login codes. Only a hash of the code is stored.
export const emailCodes = pgTable(
  "email_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_codes_email_idx").on(t.email, t.createdAt)],
);

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    // AES-256-GCM envelope, never the plain token.
    encryptedSecret: text("encrypted_secret").notNull(),
    secretHint: text("secret_hint").notNull(),
    // Non-secret settings such as Vercel team id, Neon org id or OAuth scopes.
    metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [uniqueIndex("integrations_user_provider_idx").on(t.userId, t.provider)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    idea: text("idea").notNull(),
    kind: projectKind("kind").notNull().default("app"),
    template: appTemplate("template").notNull().default("capacitor"),
    // Whether the user asked for a server/database (cloud) part.
    needsCloud: boolean("needs_cloud").notNull().default(false),
    hosting: hostingTarget("hosting").notNull().default("none"),
    // own | oracle | gcp | aws — which VPS guide to show.
    vpsProvider: text("vps_provider"),
    aiProvider: text("ai_provider").notNull(),
    status: projectStatus("status").notNull().default("draft"),
    spec: jsonb("spec").$type<AppSpec>(),
    specApprovedAt: timestamp("spec_approved_at", { withTimezone: true }),
    currentGenerationId: uuid("current_generation_id"),
    githubOwner: text("github_owner"),
    githubRepo: text("github_repo"),
    githubRepoId: bigint("github_repo_id", { mode: "number" }),
    lastCommitSha: text("last_commit_sha"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: jobKind("kind").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: jobStatus("status").notNull().default("running"),
    // Full rendered repository snapshot (template + AI files).
    files: jsonb("files").$type<GeneratedFile[]>(),
    // The AI-owned subset and requested libraries, needed to re-render on fixes.
    aiFiles: jsonb("ai_files").$type<GeneratedFile[]>(),
    libraries: jsonb("libraries").$type<string[]>(),
    warnings: jsonb("warnings").$type<string[]>(),
    notes: text("notes"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("generation_jobs_project_idx").on(t.projectId)],
);

export const buildJobs = pgTable(
  "build_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    commitSha: text("commit_sha").notNull(),
    trigger: text("trigger").notNull().default("push"),
    runId: bigint("run_id", { mode: "number" }),
    runNumber: integer("run_number"),
    runUrl: text("run_url"),
    // GitHub run status: queued | in_progress | completed (plus "waiting" before the run appears).
    status: text("status").notNull().default("waiting"),
    conclusion: text("conclusion"),
    artifactId: bigint("artifact_id", { mode: "number" }),
    releaseAssetId: bigint("release_asset_id", { mode: "number" }),
    apkName: text("apk_name"),
    apkSizeBytes: integer("apk_size_bytes"),
    failureLog: text("failure_log"),
    ...timestamps,
  },
  (t) => [index("build_jobs_project_idx").on(t.projectId)],
);

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    neonProjectId: text("neon_project_id"),
    encryptedDatabaseUrl: text("encrypted_database_url"),
    vercelProjectId: text("vercel_project_id"),
    vercelDeploymentId: text("vercel_deployment_id"),
    url: text("url"),
    // provisioning | deploying | ready | failed
    status: text("status").notNull().default("provisioning"),
    error: text("error"),
    ...timestamps,
  },
  (t) => [uniqueIndex("deployments_project_idx").on(t.projectId)],
);

export const vpsAgents = pgTable(
  "vps_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Hash of the one-time token used by the installer to register.
    registrationTokenHash: text("registration_token_hash"),
    registrationExpiresAt: timestamp("registration_expires_at", { withTimezone: true }),
    // Hash of the long-lived secret the agent uses for status reports.
    secretHash: text("secret_hash"),
    // pending | online | deploying | error
    status: text("status").notNull().default("pending"),
    hostname: text("hostname"),
    ip: text("ip"),
    url: text("url"),
    deployKeyId: bigint("deploy_key_id", { mode: "number" }),
    deployedCommit: text("deployed_commit"),
    lastMessage: text("last_message"),
    lastLog: text("last_log"),
    lastReportAt: timestamp("last_report_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("vps_agents_project_idx").on(t.projectId)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: planId("plan").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("subscriptions_user_idx").on(t.userId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: planId("plan").notNull(),
    // zarinpal | stripe
    provider: text("provider").notNull(),
    amount: integer("amount").notNull(),
    // IRT (toman) | usd (cents)
    currency: text("currency").notNull(),
    // Zarinpal authority or Stripe checkout session id.
    reference: text("reference"),
    // Zarinpal ref_id or Stripe payment intent id, after verification.
    receipt: text("receipt"),
    // pending | paid | failed
    status: text("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("payments_user_idx").on(t.userId), uniqueIndex("payments_reference_idx").on(t.provider, t.reference)],
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    purpose: text("purpose").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    usedPlatformKey: boolean("used_platform_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("usage_records_user_created_idx").on(t.userId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type GenerationJob = typeof generationJobs.$inferSelect;
export type BuildJob = typeof buildJobs.$inferSelect;
export type Deployment = typeof deployments.$inferSelect;
export type IntegrationProvider = (typeof integrationProvider.enumValues)[number];
export type AppTemplate = (typeof appTemplate.enumValues)[number];
export type ProjectKind = (typeof projectKind.enumValues)[number];
export type HostingTarget = (typeof hostingTarget.enumValues)[number];
export type PlanId = (typeof planId.enumValues)[number];
export type VpsAgent = typeof vpsAgents.$inferSelect;
