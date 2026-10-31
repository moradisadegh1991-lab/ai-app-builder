import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {
    database: false,
    // Migrations applied; sign-in or project creation fails with a database error when this is false.
    schema: false,
    appUrl: Boolean(process.env.APP_URL),
    // Valid, not just present: AES-256 needs exactly 32 bytes (base64); session tokens need 32+ characters.
    encryptionKey: Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64").length === 32,
    sessionSecret: (process.env.SESSION_SECRET ?? "").length >= 32,
    githubOAuth: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    // Optional: the Google button only shows when both are set.
    googleLogin: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    // Optional: one OpenAI-compatible gateway (e.g. Liara AI) in front of all providers.
    aiGateway: Boolean(process.env.AI_GATEWAY_BASE_URL && process.env.AI_GATEWAY_API_KEY),
    // Optional: bot check on the e-mail code request, and the rate-limit table (migration 0005).
    turnstile: Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY),
    rateLimits: false,
  };
  try {
    await db().execute(sql`select 1`);
    checks.database = true;
    // Migrations 0002 (users.google_id), 0003 (projects.attachments) and 0004 (job_kind edit) must be applied.
    const columns = await db().execute(
      sql`select 1 from information_schema.columns
          where (table_name = 'users' and column_name = 'google_id')
             or (table_name = 'projects' and column_name = 'attachments')`,
    );
    const edit = await db().execute(
      sql`select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'job_kind' and e.enumlabel = 'edit'`,
    );
    const count = (result: unknown) => (Array.isArray(result) ? result.length : ((result as { rows?: unknown[] }).rows?.length ?? 0));
    // 0004 (job_kind 'edit') is only needed by "edit with chat", but it is part of the schema all the same.
    checks.schema = count(columns) >= 2 && count(edit) >= 1;
    // Rate limiting fails open when this table is missing, so it is reported but not required for ok.
    const limits = await db().execute(sql`select 1 from information_schema.tables where table_name = 'rate_limits'`);
    checks.rateLimits = count(limits) >= 1;
  } catch {
    // keep whatever was verified before the failure
  }
  const ok = checks.database && checks.schema && checks.appUrl && checks.encryptionKey && checks.sessionSecret && checks.githubOAuth;
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
