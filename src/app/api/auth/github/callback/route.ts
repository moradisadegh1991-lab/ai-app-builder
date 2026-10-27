import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { exchangeCode, getAuthenticatedUser } from "@/lib/integrations/github";
import { saveIntegration } from "@/lib/integrations/store";
import { createSession } from "@/lib/session";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("i2a_oauth_state")?.value;
  cookieStore.delete("i2a_oauth_state");

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return NextResponse.redirect(`${env.appUrl()}/?error=oauth_state`);
  }

  try {
    const { accessToken, scope } = await exchangeCode(code);
    const ghUser = await getAuthenticatedUser(accessToken);

    const profile = {
      githubLogin: ghUser.login,
      name: ghUser.name,
      email: ghUser.email,
      avatarUrl: ghUser.avatar_url,
      updatedAt: new Date(),
    };
    const [user] = await db()
      .insert(schema.users)
      .values({ githubId: ghUser.id, ...profile })
      .onConflictDoUpdate({ target: schema.users.githubId, set: profile })
      .returning();

    await saveIntegration(user!.id, "github", accessToken, { login: ghUser.login, scope });
    await createSession(user!.id);
    return NextResponse.redirect(`${env.appUrl()}/dashboard`);
  } catch (error) {
    console.error("GitHub OAuth callback failed", error);
    return NextResponse.redirect(`${env.appUrl()}/?error=oauth_failed`);
  }
}
