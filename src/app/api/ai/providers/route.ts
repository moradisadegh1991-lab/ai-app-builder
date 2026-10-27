import { NextResponse } from "next/server";
import { platformUsageToday, providerAvailability } from "@/lib/ai";
import { env } from "@/lib/env";
import { handleRoute } from "@/lib/http";
import { requireApiUser } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const [providers, usedToday] = await Promise.all([providerAvailability(user.id), platformUsageToday(user.id)]);
    return NextResponse.json({ providers, quota: { usedToday, dailyLimit: env.aiDailyRequestLimit() } });
  });
}
