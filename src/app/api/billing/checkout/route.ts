import { NextResponse } from "next/server";
import { z } from "zod";
import { startCheckout } from "@/lib/billing/payments";
import { handleRoute, readJson } from "@/lib/http";
import { requireApiUser } from "@/lib/session";

const bodySchema = z.object({ plan: z.enum(["plus", "pro", "max"]), gateway: z.enum(["zarinpal", "stripe"]) });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const body = await readJson(request, (v) => bodySchema.parse(v));
    const redirectUrl = await startCheckout(user, body.plan, body.gateway);
    return NextResponse.json({ redirectUrl });
  });
}
