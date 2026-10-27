import { NextResponse } from "next/server";
import { beginOAuth } from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";
import { googleAuthorizeUrl, googleEnabled } from "@/lib/integrations/google";

/** Sign in / sign up with Google. */
export async function GET() {
  if (!googleEnabled()) return NextResponse.redirect(`${env.appUrl()}/?error=provider_disabled`);
  return NextResponse.redirect(googleAuthorizeUrl(await beginOAuth("google", "login")));
}
