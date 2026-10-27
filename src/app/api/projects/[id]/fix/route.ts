import { z } from "zod";
import { AI_PROVIDERS } from "@/lib/ai";
import { readJson } from "@/lib/http";
import { autoFix } from "@/lib/pipeline";
import { projectRoute, type ProjectRouteContext } from "@/lib/route-helpers";

export const maxDuration = 300;

const bodySchema = z.object({ provider: z.enum(AI_PROVIDERS).optional() });

/** Feeds the failed build log to the AI, then commits the repaired code. */
export async function POST(request: Request, ctx: ProjectRouteContext) {
  return projectRoute(ctx, async (user, project) => {
    const body = await readJson(request, (v) => bodySchema.parse(v));
    return autoFix(user, project, body.provider);
  });
}
