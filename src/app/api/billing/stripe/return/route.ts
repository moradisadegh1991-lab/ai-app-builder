import { NextResponse, type NextRequest } from "next/server";
import { confirmStripeSession } from "@/lib/billing/payments";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  const result = sessionId ? await confirmStripeSession(sessionId).catch(() => "failed" as const) : "failed";
  return NextResponse.redirect(`${env.appUrl()}/pricing?payment=${result}`);
}
