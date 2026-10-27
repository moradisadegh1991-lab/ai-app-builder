import { NextResponse } from "next/server";
import { providerAvailability } from "@/lib/ai";
import { usageSummary } from "@/lib/billing/subscription";
import { handleRoute } from "@/lib/http";
import { requireApiUser } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const [providers, usage] = await Promise.all([providerAvailability(user.id), usageSummary(user.id)]);
    return NextResponse.json({ providers, usage });
  });
}
