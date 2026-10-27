import { provisionCloud, syncDeployment } from "@/lib/pipeline";
import { projectRoute, type ProjectRouteContext } from "@/lib/route-helpers";

export const maxDuration = 120;

/** Polls the Vercel deployment; when ready, sets API_URL and rebuilds the APK. */
export async function GET(_request: Request, ctx: ProjectRouteContext) {
  return projectRoute(ctx, (user, project) => syncDeployment(user, project));
}

/** Creates the Neon database (if the app needs a backend) and the Vercel project. */
export async function POST(_request: Request, ctx: ProjectRouteContext) {
  return projectRoute(ctx, (user, project) => provisionCloud(user, project));
}
