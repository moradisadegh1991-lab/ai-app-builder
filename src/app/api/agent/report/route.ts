import { NextResponse } from "next/server";
import { recordReport, reportSchema } from "@/lib/agent";
import { handleRoute, readJson } from "@/lib/http";

export const maxDuration = 60;

/** Status reports and heartbeats from the agent (Bearer agent secret). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJson(request, (v) => reportSchema.parse(v));
    await recordReport(request.headers.get("authorization"), body);
    return NextResponse.json({ ok: true });
  });
}
