import { sleep } from "workflow";
import { sql } from "drizzle-orm";
import { queryRows } from "./sql";
import { workOne } from "./worker";
import { verifyInVercelSandbox } from "../agents/vercel-sandbox";

async function executeSlice(id: string) {
  "use step";
  console.info("Agent workflow phase started", id);
  await workOne(undefined, { runId: id, slice: true, verify: verifyInVercelSandbox });
  const [run] = await queryRows<{ status: string }>(sql`select status from workflow_runs where id=${id}::uuid`);
  console.info("Agent workflow phase finished", id, run?.status);
  return run?.status ?? "cancelled";
}

async function recordRuntimeFailure(id: string) {
  "use step";
  // An exhausted platform retry must not leave the application queue stuck.
  await queryRows(sql`with failed as (
    update workflow_runs set status='failed',error='اجرای Vercel Workflow متوقف شد؛ دوباره تلاش کنید.',
    finished_at=now(),lease_expires_at=null,owner_token=null,updated_at=now()
    where id=${id}::uuid and status in ('queued','running') returning project_id
  ) update projects set last_error='اجرای Vercel Workflow متوقف شد؛ دوباره تلاش کنید.',updated_at=now()
    where id in(select project_id from failed) returning id`);
}

export async function processAgentRun(id: string) {
  "use workflow";
  try {
    for (;;) {
      const status = await executeSlice(id);
      if (status !== "queued" && status !== "running") return { status };
      // A previous invocation may still own its lease after an interrupted call.
      if (status === "running") await sleep("30 seconds");
    }
  } catch (error) {
    await recordRuntimeFailure(id);
    throw error;
  }
}
