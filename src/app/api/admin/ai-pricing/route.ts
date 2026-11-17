import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { handleRoute, HttpError, readJson } from "@/lib/http";
import { requireApiUser } from "@/lib/session";
import { requirePricingAdmin, saveTariff, tariffInput } from "@/lib/ai/admin-pricing";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireApiUser();
    requirePricingAdmin(user.id);
    const entries = await db().select().from(schema.aiTariffs);
    return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
  });
}
export async function PUT(request: Request) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    requirePricingAdmin(user.id);
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) throw new HttpError(403, "مبدأ درخواست مجاز نیست.");
    const input = await readJson(request, value => tariffInput.parse(value));
    return NextResponse.json({ price: await saveTariff(user.id, input) });
  });
}
