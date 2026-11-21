import { authorizedMaintenance } from "@/lib/workflows/cron-auth";
import { sql } from "drizzle-orm";
import { queryRows } from "@/lib/workflows/sql";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizedMaintenance(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const runs = await queryRows<{ id: string }>(sql`select id from workflow_runs
    where status='queued' or (status='running' and lease_expires_at<now()) order by created_at limit 20`);
  // Workers poll and reclaim expired leases themselves; this endpoint only reports backlog.
  return Response.json({ pending: runs.length, runtime: "self-hosted-worker" });
}
