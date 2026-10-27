import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { authorizeUrl } from "@/lib/integrations/github";
import { getCurrentUser } from "@/lib/session";

/** Starts connecting GitHub to the signed-in account (login itself is by e-mail code). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${env.appUrl()}/`);
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("i2a_oauth_state", state, {
    httpOnly: true,
    secure: env.isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(state));
}
