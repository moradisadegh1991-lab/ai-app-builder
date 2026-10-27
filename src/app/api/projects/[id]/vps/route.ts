import { NextResponse } from "next/server";
import { createRegistration, disconnectAgent } from "@/lib/agent";
import { handleRoute } from "@/lib/http";
import { getOwnedProject, projectView } from "@/lib/projects";
import type { ProjectRouteContext } from "@/lib/route-helpers";
import { requireApiUser } from "@/lib/session";

/** Creates a one-time install command for the project's VPS. The token is returned only here. */
export async function POST(_request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    const install = await createRegistration(project);
    return NextResponse.json({ install, project: await projectView(project) });
  });
}

export async function DELETE(_request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    await disconnectAgent(project);
    return NextResponse.json({ project: await projectView(project) });
  });
}
