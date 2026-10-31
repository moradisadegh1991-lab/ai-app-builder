-- Idea2App AI: full database setup (= drizzle/0000 .. 0005) as ONE statement.
-- Neon's SQL Editor runs a single statement per click, so everything is wrapped in a DO block.
-- Run it once on an EMPTY database. Turn the editor's "Read-only" switch OFF first.
-- Existing database? Run only the newest drizzle/000N_*.sql files you have not applied yet.
DO $setup$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    RAISE EXCEPTION 'Tables already exist; do not run the full setup again (see the README for single migrations).';
  END IF;
CREATE TYPE "public"."app_template" AS ENUM('capacitor', 'expo');
CREATE TYPE "public"."integration_provider" AS ENUM('github', 'vercel', 'neon', 'openai', 'anthropic', 'gemini');
CREATE TYPE "public"."job_kind" AS ENUM('spec', 'code', 'fix');
CREATE TYPE "public"."job_status" AS ENUM('running', 'succeeded', 'failed');
CREATE TYPE "public"."project_status" AS ENUM('draft', 'spec_ready', 'spec_approved', 'generating', 'generated', 'pushed', 'failed');
CREATE TABLE "build_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"commit_sha" text NOT NULL,
	"trigger" text DEFAULT 'push' NOT NULL,
	"run_id" bigint,
	"run_number" integer,
	"run_url" text,
	"status" text DEFAULT 'waiting' NOT NULL,
	"conclusion" text,
	"artifact_id" bigint,
	"release_asset_id" bigint,
	"apk_name" text,
	"apk_size_bytes" integer,
	"failure_log" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"neon_project_id" text,
	"encrypted_database_url" text,
	"vercel_project_id" text,
	"vercel_deployment_id" text,
	"url" text,
	"status" text DEFAULT 'provisioning' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "job_kind" NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" "job_status" DEFAULT 'running' NOT NULL,
	"files" jsonb,
	"ai_files" jsonb,
	"libraries" jsonb,
	"warnings" jsonb,
	"notes" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"encrypted_secret" text NOT NULL,
	"secret_hint" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"idea" text NOT NULL,
	"template" "app_template" DEFAULT 'capacitor' NOT NULL,
	"ai_provider" text NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"spec" jsonb,
	"spec_approved_at" timestamp with time zone,
	"current_generation_id" uuid,
	"github_owner" text,
	"github_repo" text,
	"github_repo_id" bigint,
	"last_commit_sha" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"purpose" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"used_platform_key" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" bigint NOT NULL,
	"github_login" text NOT NULL,
	"name" text,
	"email" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "build_jobs_project_idx" ON "build_jobs" USING btree ("project_id");
CREATE UNIQUE INDEX "deployments_project_idx" ON "deployments" USING btree ("project_id");
CREATE INDEX "generation_jobs_project_idx" ON "generation_jobs" USING btree ("project_id");
CREATE UNIQUE INDEX "integrations_user_provider_idx" ON "integrations" USING btree ("user_id","provider");
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("user_id");
CREATE INDEX "usage_records_user_created_idx" ON "usage_records" USING btree ("user_id","created_at");
CREATE TYPE "public"."hosting_target" AS ENUM('none', 'vps', 'vercel');
CREATE TYPE "public"."plan_id" AS ENUM('free', 'plus', 'pro', 'max');
CREATE TYPE "public"."project_kind" AS ENUM('app', 'website');
ALTER TYPE "public"."app_template" ADD VALUE 'web';
CREATE TABLE "email_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "plan_id" NOT NULL,
	"provider" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"reference" text,
	"receipt" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "plan_id" NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "vps_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"registration_token_hash" text,
	"registration_expires_at" timestamp with time zone,
	"secret_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"hostname" text,
	"ip" text,
	"url" text,
	"deploy_key_id" bigint,
	"deployed_commit" text,
	"last_message" text,
	"last_log" text,
	"last_report_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "users" ALTER COLUMN "github_id" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "github_login" DROP NOT NULL;
-- Accounts created by the earlier GitHub login may have no public e-mail.
UPDATE "users" SET "email" = "github_login" || '@users.noreply.github.com' WHERE "email" IS NULL;
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "projects" ADD COLUMN "kind" "project_kind" DEFAULT 'app' NOT NULL;
ALTER TABLE "projects" ADD COLUMN "needs_cloud" boolean DEFAULT false NOT NULL;
ALTER TABLE "projects" ADD COLUMN "hosting" "hosting_target" DEFAULT 'none' NOT NULL;
ALTER TABLE "projects" ADD COLUMN "vps_provider" text;
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "vps_agents" ADD CONSTRAINT "vps_agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "email_codes_email_idx" ON "email_codes" USING btree ("email","created_at");
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");
CREATE UNIQUE INDEX "payments_reference_idx" ON "payments" USING btree ("provider","reference");
CREATE UNIQUE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");
CREATE UNIQUE INDEX "vps_agents_project_idx" ON "vps_agents" USING btree ("project_id");
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
ALTER TABLE "users" ADD COLUMN "google_id" text;
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");
ALTER TABLE "projects" ADD COLUMN "attachments" jsonb;
ALTER TYPE "public"."job_kind" ADD VALUE 'edit';
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
END
$setup$;
