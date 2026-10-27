import { NextResponse, type NextRequest } from "next/server";
import { verifyZarinpal } from "@/lib/billing/payments";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const authority = request.nextUrl.searchParams.get("Authority") ?? "";
  const status = request.nextUrl.searchParams.get("Status") ?? "";
  const result = authority ? await verifyZarinpal(authority, status).catch(() => "failed" as const) : "failed";
  return NextResponse.redirect(`${env.appUrl()}/pricing?payment=${result}`);
}
