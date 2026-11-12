import { z } from "zod";
import { AI_PROVIDERS } from "@/lib/ai";
import { readJson } from "@/lib/http";
import { enqueueWorkflow } from "@/lib/workflows/queue";
import { projectRoute, type ProjectRouteContext } from "@/lib/route-helpers";

export const maxDuration = 300;

const bodySchema = z.object({
  instruction: z.string().trim().min(5, "تغییر مورد نظر را کمی کامل‌تر بنویسید.").max(3000),
  provider: z.enum(AI_PROVIDERS).optional(),
});

/** Applies a change described in plain words and commits it, which starts a new build. */
export async function POST(request: Request, ctx: ProjectRouteContext) {
  return projectRoute(
    ctx,
    async (user, project) => {
      const body = await readJson(request, (v) => bodySchema.parse(v));
      return enqueueWorkflow(user, project, {
        kind: "edit",
        provider: body.provider ?? (project.aiProvider as "openai" | "anthropic" | "gemini"),
        instruction: body.instruction,
      });
    },
    { status: 202 },
  );
}
