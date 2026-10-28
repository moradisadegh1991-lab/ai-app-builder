import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {
    database: false,
    // Migrations applied (0002 adds users.google_id); sign-in fails with a database error when this is false.
    schema: false,
    appUrl: Boolean(process.env.APP_URL),
    encryptionKey: Boolean(process.env.ENCRYPTION_KEY),
    sessionSecret: Boolean(process.env.SESSION_SECRET),
    githubOAuth: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    // Optional: the Google button only shows when both are set.
    googleLogin: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  };
  try {
    await db().execute(sql`select 1`);
    checks.database = true;
    const columns = await db().execute(
      sql`select 1 from information_schema.columns where table_name = 'users' and column_name = 'google_id'`,
    );
    checks.schema = (Array.isArray(columns) ? columns.length : (columns as { rows?: unknown[] }).rows?.length ?? 0) > 0;
  } catch {
    // keep whatever was verified before the failure
  }
  const ok = checks.database && checks.schema && checks.appUrl && checks.encryptionKey && checks.sessionSecret && checks.githubOAuth;
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
