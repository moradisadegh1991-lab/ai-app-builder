import { z } from "zod";
import { AI_PROVIDERS } from "@/lib/ai";
import { readJson } from "@/lib/http";
import { generateCode } from "@/lib/pipeline";
import { projectRoute, type ProjectRouteContext } from "@/lib/route-helpers";

export const maxDuration = 300;

const bodySchema = z.object({ provider: z.enum(AI_PROVIDERS).optional() });

export async function POST(request: Request, ctx: ProjectRouteContext) {
  return projectRoute(ctx, async (user, project) => {
    const body = await readJson(request, (v) => bodySchema.parse(v));
    return generateCode(user, project, body.provider);
  });
}
