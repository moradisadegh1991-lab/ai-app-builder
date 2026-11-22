import { sql } from "drizzle-orm";
import { queryRows } from "../src/lib/workflows/sql";
import { workOne } from "../src/lib/workflows/worker";

// Only explicit code generation is processed by this worker.
const shutdown = new AbortController();
process.on("SIGTERM", () => shutdown.abort());
process.on("SIGINT", () => shutdown.abort());
async function main() {
  while (!shutdown.signal.aborted) {
    try {
      const rows = await queryRows<{ id: string }>(sql`select id from workflow_runs
        where input->>'kind'='code' and (status='queued' or (status='running' and lease_expires_at<now()))
        order by created_at limit 1`);
      if (rows[0]) await workOne(shutdown.signal, { runId: rows[0].id });
      else await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch {
      // Do not leak credentials or provider details into the service log.
      console.error("Worker could not process queue; retrying.");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
main().catch(() => { console.error("Worker stopped."); process.exitCode = 1; });
