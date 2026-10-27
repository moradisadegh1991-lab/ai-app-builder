import { pushToGitHub } from "@/lib/pipeline";
import { projectRoute, type ProjectRouteContext } from "@/lib/route-helpers";

export const maxDuration = 60;

/** Creates the repository (first time) and commits the generated code; the push starts the APK build. */
export async function POST(_request: Request, ctx: ProjectRouteContext) {
  return projectRoute(ctx, (user, project) => pushToGitHub(user, project));
}
