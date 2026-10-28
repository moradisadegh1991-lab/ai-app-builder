import { NextResponse, type NextRequest } from "next/server";
import { consumeOAuth, oauthFailureRedirect } from "@/lib/auth/oauth-state";
import { signInWithIdentity } from "@/lib/auth/social";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { fetchGoogleProfile, GoogleOAuthError } from "@/lib/integrations/google";
import { createSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const app = env.appUrl();
  const check = await consumeOAuth("google", request.nextUrl.searchParams.get("state"));
  const code = request.nextUrl.searchParams.get("code");
  if (!check.ok || check.mode !== "login" || !code) {
    return NextResponse.redirect(oauthFailureRedirect(app, check, request.nextUrl.searchParams.get("error")));
  }

  let stage = "token";
  try {
    const profile = await fetchGoogleProfile(code);
    stage = "database";
    const user = await signInWithIdentity({
      provider: "google",
      providerId: profile.sub,
      // An unverified Google address must never be used to claim an existing account.
      email: profile.emailVerified ? profile.email : null,
      name: profile.name,
      avatarUrl: profile.picture,
    });
    await createSession(user.id);
    return NextResponse.redirect(`${app}/dashboard`);
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    if (error instanceof HttpError) {
      return NextResponse.redirect(`${app}/?error=${error.status === 409 ? "account_conflict" : "no_verified_email"}`);
    }
    // "detail" tells which step broke (Google's token endpoint, userinfo, or our own database) without leaking anything.
    const detail = error instanceof GoogleOAuthError ? `${error.stage}_${error.detail}` : stage;
    return NextResponse.redirect(`${app}/?error=oauth_failed&detail=${detail}`);
  }
}
