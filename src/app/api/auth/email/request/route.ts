import { NextResponse } from "next/server";
import { z } from "zod";
import { requestLoginCode } from "@/lib/auth/email-code";
import { handleRoute, readJson } from "@/lib/http";

const bodySchema = z.object({ email: z.string().max(254) });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJson(request, (v) => bodySchema.parse(v));
    const email = await requestLoginCode(body.email);
    return NextResponse.json({ ok: true, email });
  });
}
