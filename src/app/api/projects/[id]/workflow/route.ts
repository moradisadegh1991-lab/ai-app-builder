import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { getOwnedProject, projectView } from "@/lib/projects";
import { handleRoute, HttpError } from "@/lib/http";
import { queryRows } from "@/lib/workflows/sql";
import type { ProjectRouteContext } from "@/lib/route-helpers";

export async function GET(request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    const url = new URL(request.url);
    const task = url.searchParams.get("task"),
      name = url.searchParams.get("screenshot");
    if (task && name) {
      if (!/^[0-9a-f-]{36}$/i.test(task) || !["mobile", "desktop"].includes(name))
        throw new HttpError(404, "تصویر پیدا نشد.");
      const rows = await queryRows<{
        output: { screenshots: { name: string; data: string; mime: string }[] };
      }>(sql`select t.output from agent_tasks t join workflow_runs r on r.id=t.run_id
        where t.id=${task}::uuid and r.project_id=${project.id} and r.user_id=${user.id} and t.role='verifier' and t.status='succeeded'`);
      const screenshot = rows[0]?.output.screenshots?.find((s) => s.name === name);
      if (!screenshot || screenshot.mime !== "image/png") throw new HttpError(404, "تصویر پیدا نشد.");
      return new Response(Buffer.from(screenshot.data, "base64"), {
        headers: {
          "content-type": "image/png",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }
    return NextResponse.json({ project: await projectView(project) });
  });
}
export async function DELETE(_request: Request, ctx: ProjectRouteContext) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const project = await getOwnedProject(user.id, (await ctx.params).id);
    await queryRows(sql`with cancelled as (
      update workflow_runs set status='cancelled',owner_token=null,lease_expires_at=null,finished_at=now(),updated_at=now()
      where project_id=${project.id} and user_id=${user.id} and status in ('queued','running') returning id
    ) update agent_tasks set status='cancelled',updated_at=now() where run_id in(select id from cancelled) and status='running' returning id`);
    return NextResponse.json({ project: await projectView(project) });
  });
}
