import { timingSafeEqual } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { exchangeCode, getAuthenticatedUser } from "@/lib/integrations/github";
import { saveIntegration } from "@/lib/integrations/store";
import { getCurrentUser } from "@/lib/session";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${env.appUrl()}/`);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("i2a_oauth_state")?.value;
  cookieStore.delete("i2a_oauth_state");
  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return NextResponse.redirect(`${env.appUrl()}/settings?github=state_error`);
  }

  try {
    const { accessToken, scope } = await exchangeCode(code);
    const ghUser = await getAuthenticatedUser(accessToken);

    const [taken] = await db()
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.githubId, ghUser.id), ne(schema.users.id, user.id)))
      .limit(1);
    if (taken) return NextResponse.redirect(`${env.appUrl()}/settings?github=already_linked`);

    await db()
      .update(schema.users)
      .set({
        githubId: ghUser.id,
        githubLogin: ghUser.login,
        name: user.name ?? ghUser.name,
        avatarUrl: ghUser.avatar_url,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));
    await saveIntegration(user.id, "github", accessToken, { login: ghUser.login, scope });
    return NextResponse.redirect(`${env.appUrl()}/settings?github=connected`);
  } catch (error) {
    console.error("GitHub OAuth callback failed", error);
    return NextResponse.redirect(`${env.appUrl()}/settings?github=failed`);
  }
}
