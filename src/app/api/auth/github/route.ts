import { NextResponse } from "next/server";
import { beginOAuth } from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";
import { authorizeUrl } from "@/lib/integrations/github";
import { getCurrentUser } from "@/lib/session";

/** Connect GitHub (with repository + workflow access) to the signed-in account. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${env.appUrl()}/`);
  return NextResponse.redirect(authorizeUrl(await beginOAuth("github", "connect")));
}
