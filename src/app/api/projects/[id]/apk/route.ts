import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { downloadApkUrl } from "@/lib/pipeline";
import { getOwnedProject } from "@/lib/projects";
import type { ProjectRouteContext } from "@/lib/route-helpers";
import { requireApiUser } from "@/lib/session";

/**
 * Redirects to a short-lived signed GitHub download URL, so private
 * repositories work without exposing the user's token to the browser.
 */
export async function GET(_request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    const url = await downloadApkUrl(user, project);
    return NextResponse.redirect(url, { status: 302 });
  });
}
