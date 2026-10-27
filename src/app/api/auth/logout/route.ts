import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(`${env.appUrl()}/`, { status: 303 });
}
