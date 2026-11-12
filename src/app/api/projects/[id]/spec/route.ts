import { z } from "zod";
import { AI_PROVIDERS } from "@/lib/ai";
import { readJson } from "@/lib/http";
import { approveSpec } from "@/lib/pipeline";
import { enqueueWorkflow } from "@/lib/workflows/queue";
import { projectRoute, type ProjectRouteContext } from "@/lib/route-helpers";
import { appSpecSchema } from "@/lib/spec";

export const maxDuration = 300;

const generateSchema = z.object({
  feedback: z.string().trim().max(3000).optional(),
  provider: z.enum(AI_PROVIDERS).optional(),
});

const approveSchema = z.object({ spec: appSpecSchema.optional() });

/** Generates (or revises with feedback) the requirements document. */
export async function POST(request: Request, ctx: ProjectRouteContext) {
  return projectRoute(
    ctx,
    async (user, project) => {
      const body = await readJson(request, (v) => generateSchema.parse(v));
      return enqueueWorkflow(user, project, {
        kind: "spec",
        provider: body.provider ?? (project.aiProvider as "openai" | "anthropic" | "gemini"),
        feedback: body.feedback || undefined,
      });
    },
    { mutation: true, status: 202 },
  );
}

/** Approves the requirements, optionally with user edits. */
export async function PUT(request: Request, ctx: ProjectRouteContext) {
  return projectRoute(
    ctx,
    async (_user, project) => {
      const body = await readJson(request, (v) => approveSchema.parse(v));
      return approveSpec(project, body.spec);
    },
    { mutation: true },
  );
}
