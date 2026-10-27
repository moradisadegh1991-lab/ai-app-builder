import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, handleRoute, readJson } from "@/lib/http";
import { deleteIntegration, listIntegrations, saveIntegration } from "@/lib/integrations/store";
import { requireApiUser } from "@/lib/session";

// GitHub is managed through OAuth login, so it is not editable here.
const editableProvider = z.enum(["vercel", "neon", "openai", "anthropic", "gemini"]);

const saveSchema = z.object({
  provider: editableProvider,
  secret: z.string().trim().min(8).max(500),
  metadata: z
    .object({
      teamId: z.string().trim().max(100).optional(),
      orgId: z.string().trim().max(100).optional(),
      model: z.string().trim().max(100).optional(),
    })
    .default({}),
});

export async function GET() {
  return handleRoute(async () => {
    const user = await requireApiUser();
    return NextResponse.json({ integrations: await listIntegrations(user.id) });
  });
}

export async function PUT(request: Request) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const body = await readJson(request, (v) => saveSchema.parse(v));
    const metadata = Object.fromEntries(Object.entries(body.metadata).filter(([, v]) => v)) as Record<string, string>;
    await saveIntegration(user.id, body.provider, body.secret, metadata);
    return NextResponse.json({ integrations: await listIntegrations(user.id) });
  });
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const parsed = editableProvider.safeParse(request.nextUrl.searchParams.get("provider"));
    if (!parsed.success) throw new HttpError(400, "ارائه‌دهنده نامعتبر است.");
    await deleteIntegration(user.id, parsed.data);
    return NextResponse.json({ integrations: await listIntegrations(user.id) });
  });
}
