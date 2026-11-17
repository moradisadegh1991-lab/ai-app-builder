import { NextResponse } from "next/server";
import { handleRoute, HttpError } from "@/lib/http";
import { getOwnedProject } from "@/lib/projects";
import type { ProjectRouteContext } from "@/lib/route-helpers";
import { requireApiUser } from "@/lib/session";
import { loadVisualProject } from "@/lib/visual/store";
import { renderVisualApp } from "@/lib/visual/render";
export async function GET(_request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    const document = await loadVisualProject(user.id, project.id);
    if (!document) throw new HttpError(404, "ابتدا پیش‌نویس را ذخیره کنید.");
    return NextResponse.json({ revision: document.revision, file: renderVisualApp(document) });
  });
}
