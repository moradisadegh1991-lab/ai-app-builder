import { NextResponse } from "next/server";
import { z } from "zod";
import { requestLoginCode } from "@/lib/auth/email-code";
import { handleRoute, readJson } from "@/lib/http";
import { clientKey, enforce } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const bodySchema = z.object({ email: z.string().max(254), turnstileToken: z.string().max(4096).optional() });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJson(request, (v) => bodySchema.parse(v));
    // Per address: a mail bomb aimed at other people's inboxes costs the platform's sender reputation.
    await enforce("email-request", clientKey(request), 10, 3600, "درخواست کد ورود");
    await verifyTurnstile(body.turnstileToken, request.headers.get("x-real-ip") ?? undefined);
    const email = await requestLoginCode(body.email);
    return NextResponse.json({ ok: true, email });
  });
}
