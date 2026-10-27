import { NextResponse } from "next/server";
import { beginOAuth } from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";
import { handleRoute } from "@/lib/http";
import { GITHUB_LOGIN_SCOPES, authorizeUrl } from "@/lib/integrations/github";

/** Sign in / sign up with GitHub. Asks only for identity (no repository access). */
export async function GET() {
  return handleRoute(async () => {
    if (!env.githubConfigured()) return NextResponse.redirect(`${env.appUrl()}/?error=provider_disabled`);
    return NextResponse.redirect(authorizeUrl(await beginOAuth("github", "login"), GITHUB_LOGIN_SCOPES));
  });
}
