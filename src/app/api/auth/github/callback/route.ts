import { and, eq, ne } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { consumeOAuth, oauthFailureRedirect } from "@/lib/auth/oauth-state";
import { signInWithIdentity } from "@/lib/auth/social";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { exchangeCode, getAuthenticatedUser, getVerifiedEmail } from "@/lib/integrations/github";
import { saveIntegration } from "@/lib/integrations/store";
import { createSession, getCurrentUser } from "@/lib/session";

/** One callback URL for both modes: signing in, and connecting GitHub to an existing account. */
export async function GET(request: NextRequest) {
  const check = await consumeOAuth("github", request.nextUrl.searchParams.get("state"));
  const code = request.nextUrl.searchParams.get("code");
  const app = env.appUrl();

  if (!check.ok || !code) {
    // A failed connect (signed-in user) goes back to settings; a failed sign-in goes to the landing page.
    return NextResponse.redirect(
      check.ok && check.mode === "connect"
        ? `${app}/settings?github=${request.nextUrl.searchParams.get("error") ? "denied" : "state_error"}`
        : oauthFailureRedirect(app, check, request.nextUrl.searchParams.get("error")),
    );
  }
  const mode = check.mode;

  try {
    const { accessToken, scope } = await exchangeCode(code);
    const ghUser = await getAuthenticatedUser(accessToken);

    if (mode === "login") {
      const user = await signInWithIdentity({
        provider: "github",
        providerId: ghUser.id,
        email: await getVerifiedEmail(accessToken),
        name: ghUser.name,
        avatarUrl: ghUser.avatar_url,
        githubLogin: ghUser.login,
      });
      // The token only proved identity; it is not stored. Repository access is a separate "connect" step.
      await createSession(user.id);
      return NextResponse.redirect(`${app}/dashboard`);
    }

    const user = await getCurrentUser();
    if (!user) return NextResponse.redirect(`${app}/`);
    const [taken] = await db()
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.githubId, ghUser.id), ne(schema.users.id, user.id)))
      .limit(1);
    if (taken) return NextResponse.redirect(`${app}/settings?github=already_linked`);

    await db()
      .update(schema.users)
      .set({
        githubId: ghUser.id,
        githubLogin: ghUser.login,
        name: user.name ?? ghUser.name,
        avatarUrl: user.avatarUrl ?? ghUser.avatar_url,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));
    await saveIntegration(user.id, "github", accessToken, { login: ghUser.login, scope });
    return NextResponse.redirect(`${app}/settings?github=connected`);
  } catch (error) {
    console.error("GitHub OAuth callback failed", error);
    if (mode === "login") {
      const reason = error instanceof HttpError ? (error.status === 409 ? "account_conflict" : "no_verified_email") : "oauth_failed";
      return NextResponse.redirect(`${app}/?error=${reason}`);
    }
    return NextResponse.redirect(`${app}/settings?github=failed`);
  }
}
