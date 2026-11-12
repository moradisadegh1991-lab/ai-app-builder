import { NextResponse } from "next/server";
import { handleRoute } from "./http";
import { getOwnedProject, projectView } from "./projects";
import { requireApiUser } from "./session";
import type { schema } from "./db";
import { assertProjectIdle } from "./workflows/queue";

export interface ProjectRouteContext {
  params: Promise<{ id: string }>;
}

/** Authenticates, loads the caller's project and returns its fresh view. */
export function projectRoute(
  ctx: ProjectRouteContext,
  action: (user: schema.User, project: schema.Project) => Promise<unknown>,
  options: { mutation?: boolean; status?: number } = {},
) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const project = await getOwnedProject(user.id, id);
    if (options.mutation) await assertProjectIdle(project.id);
    await action(user, project);
    const fresh = await getOwnedProject(user.id, id);
    return NextResponse.json({ project: await projectView(fresh) }, { status: options.status ?? 200 });
  });
}
