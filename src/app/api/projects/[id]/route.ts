import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { handleRoute } from "@/lib/http";
import { getOwnedProject, projectView } from "@/lib/projects";
import type { ProjectRouteContext } from "@/lib/route-helpers";
import { requireApiUser } from "@/lib/session";

export async function GET(_request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    return NextResponse.json({ project: await projectView(project) });
  });
}

/** Removes the project from the platform only; the GitHub repo, Vercel and Neon projects are kept. */
export async function DELETE(_request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    await db()
      .delete(schema.projects)
      .where(and(eq(schema.projects.id, project.id), eq(schema.projects.userId, user.id)));
    return NextResponse.json({ ok: true });
  });
}
