import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {
    database: false,
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
  } catch {
    checks.database = false;
  }
  const ok = checks.database && checks.encryptionKey && checks.sessionSecret && checks.githubOAuth;
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
