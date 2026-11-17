import { NextResponse } from "next/server";
import { handleRoute, HttpError } from "@/lib/http";
import { getOwnedProject } from "@/lib/projects";
import type { ProjectRouteContext } from "@/lib/route-helpers";
import { requireApiUser } from "@/lib/session";
import { loadVisualProject, saveVisualProject } from "@/lib/visual/store";

const MAX_BYTES = 512 * 1024;
async function readBounded(request: Request) {
  if (!request.body) throw new HttpError(400, "داده‌ای ارسال نشده است.");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new HttpError(413, "حجم داده ویرایشگر بیش از حد مجاز است."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(data)) as unknown; }
  catch { throw new HttpError(400, "داده JSON معتبر نیست."); }
}
export async function GET(_request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    return NextResponse.json({ document: await loadVisualProject(user.id, project.id) });
  });
}
export async function PUT(request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    return NextResponse.json({ document: await saveVisualProject(user.id, project.id, await readBounded(request)) });
  });
}
