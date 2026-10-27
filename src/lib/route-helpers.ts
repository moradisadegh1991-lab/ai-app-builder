import { NextResponse } from "next/server";
import { handleRoute } from "./http";
import { getOwnedProject, projectView } from "./projects";
import { requireApiUser } from "./session";
import type { schema } from "./db";

export interface ProjectRouteContext {
  params: Promise<{ id: string }>;
}

/** Authenticates, loads the caller's project and returns its fresh view. */
export function projectRoute(
  ctx: ProjectRouteContext,
  action: (user: schema.User, project: schema.Project) => Promise<unknown>,
) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const project = await getOwnedProject(user.id, id);
    await action(user, project);
    const fresh = await getOwnedProject(user.id, id);
    return NextResponse.json({ project: await projectView(fresh) });
  });
}
