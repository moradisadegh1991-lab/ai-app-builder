import { NextResponse } from "next/server";
import { beginOAuth } from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";
import { handleRoute } from "@/lib/http";
import { googleAuthorizeUrl, googleEnabled } from "@/lib/integrations/google";

/** Sign in / sign up with Google. */
export async function GET() {
  // handleRoute turns a misconfiguration (e.g. missing APP_URL) into a readable JSON error.
  return handleRoute(async () => {
    if (!googleEnabled()) return NextResponse.redirect(`${env.appUrl()}/?error=provider_disabled`);
    return NextResponse.redirect(googleAuthorizeUrl(await beginOAuth("google", "login")));
  });
}
