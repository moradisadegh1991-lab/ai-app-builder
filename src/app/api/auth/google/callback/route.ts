import { NextResponse, type NextRequest } from "next/server";
import { consumeOAuth } from "@/lib/auth/oauth-state";
import { signInWithIdentity } from "@/lib/auth/social";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { fetchGoogleProfile } from "@/lib/integrations/google";
import { createSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const app = env.appUrl();
  const mode = await consumeOAuth("google", request.nextUrl.searchParams.get("state"));
  const code = request.nextUrl.searchParams.get("code");
  if (mode !== "login" || !code) return NextResponse.redirect(`${app}/?error=oauth_state`);

  try {
    const profile = await fetchGoogleProfile(code);
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
    const reason = error instanceof HttpError ? (error.status === 409 ? "account_conflict" : "no_verified_email") : "oauth_failed";
    return NextResponse.redirect(`${app}/?error=${reason}`);
  }
}
