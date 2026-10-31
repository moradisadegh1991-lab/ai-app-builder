import { NextResponse } from "next/server";
import { beginOAuth } from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";
import { HttpError, handleRoute } from "@/lib/http";
import { clientKey, enforce } from "@/lib/rate-limit";
import { googleAuthorizeUrl, googleEnabled } from "@/lib/integrations/google";

/** Sign in / sign up with Google. */
export async function GET(request: Request) {
  // handleRoute turns a misconfiguration (e.g. missing APP_URL) into a readable JSON error.
  return handleRoute(async () => {
    try {
      await enforce("oauth-start", clientKey(request), 60, 600);
    } catch (error) {
      if (error instanceof HttpError) return NextResponse.redirect(`${env.appUrl()}/?error=rate_limited`);
      throw error;
    }
    if (!googleEnabled()) return NextResponse.redirect(`${env.appUrl()}/?error=provider_disabled`);
    return NextResponse.redirect(googleAuthorizeUrl(await beginOAuth("google", "login")));
  });
}
