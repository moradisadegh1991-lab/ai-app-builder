import { NextResponse } from "next/server";
import { beginOAuth } from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";
import { HttpError, handleRoute } from "@/lib/http";
import { clientKey, enforce } from "@/lib/rate-limit";
import { GITHUB_LOGIN_SCOPES, authorizeUrl } from "@/lib/integrations/github";

/** Sign in / sign up with GitHub. Asks only for identity (no repository access). */
export async function GET(request: Request) {
  return handleRoute(async () => {
    try {
      await enforce("oauth-start", clientKey(request), 60, 600);
    } catch (error) {
      if (error instanceof HttpError) return NextResponse.redirect(`${env.appUrl()}/?error=rate_limited`);
      throw error;
    }
    if (!env.githubConfigured()) return NextResponse.redirect(`${env.appUrl()}/?error=provider_disabled`);
    return NextResponse.redirect(authorizeUrl(await beginOAuth("github", "login"), GITHUB_LOGIN_SCOPES));
  });
}
