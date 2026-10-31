import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyLoginCode } from "@/lib/auth/email-code";
import { handleRoute, readJson } from "@/lib/http";
import { clientKey, enforce } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";

const bodySchema = z.object({ email: z.string().max(254), code: z.string().max(20) });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJson(request, (v) => bodySchema.parse(v));
    await enforce("email-verify", clientKey(request), 30, 600, "تلاش برای ورود");
    const user = await verifyLoginCode(body.email, body.code);
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  });
}
