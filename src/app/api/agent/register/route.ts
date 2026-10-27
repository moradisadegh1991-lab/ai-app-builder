import { NextResponse } from "next/server";
import { registerAgent, registerSchema } from "@/lib/agent";
import { handleRoute, readJson } from "@/lib/http";

export const maxDuration = 60;

/** Called by the installer on the VPS (no user session; the one-time token authorizes it). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJson(request, (v) => registerSchema.parse(v));
    return NextResponse.json(await registerAgent(body));
  });
}
