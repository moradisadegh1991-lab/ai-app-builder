import { authorizedMaintenance } from "@/lib/workflows/cron-auth";
import { sql } from "drizzle-orm";
import { queryRows } from "@/lib/workflows/sql";
import { dispatchWorkflow } from "@/lib/workflows/dispatch";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizedMaintenance(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const runs = await queryRows<{ id: string }>(sql`select id from workflow_runs
    where status='queued' or (status='running' and lease_expires_at<now()) order by created_at limit 20`);
  await Promise.all(runs.map((run) => dispatchWorkflow(run.id)));
  return Response.json({ dispatched: runs.length });
}
