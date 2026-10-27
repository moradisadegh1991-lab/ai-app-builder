import { rebuild, syncBuild } from "@/lib/pipeline";
import { projectRoute, type ProjectRouteContext } from "@/lib/route-helpers";

export const maxDuration = 60;

/** Refreshes the latest build from GitHub Actions (polled by the UI). */
export async function GET(_request: Request, ctx: ProjectRouteContext) {
  return projectRoute(ctx, (user, project) => syncBuild(user, project));
}

/** Starts a new build of the current commit via workflow_dispatch. */
export async function POST(_request: Request, ctx: ProjectRouteContext) {
  return projectRoute(ctx, (user, project) => rebuild(user, project));
}
