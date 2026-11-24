import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const app = "/opt/moradi-apps/ideaapp";
const [pid, anchor] = process.argv.slice(2);
const models = new Set(["gemini-2.5-pro", "kimi-k2.6"]);
const roles = new Set(["architect", "designer", "frontend", "backend", "reviewer", "debugger", "verifier", "publisher"]);
let sql;
try {
  if (!/^[1-9]\d*$/.test(pid ?? "") || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(anchor ?? "")) {
    throw new Error("invalid input");
  }
  const requireFromApp = createRequire(`${app}/package.json`);
  delete process.env.DATABASE_URL;
  const fromService = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").find((entry) => entry.startsWith("DATABASE_URL="));
  if (fromService) process.env.DATABASE_URL = fromService.slice("DATABASE_URL=".length);
  requireFromApp("@next/env").loadEnvConfig(app, false, { info() {}, error() {} });
  const url = new URL(process.env.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("unexpected database");
  sql = requireFromApp("postgres")(process.env.DATABASE_URL, { max: 1, connect_timeout: 8, prepare: false });
  const report = await sql.begin("read only", async (tx) => {
    const [run] = await tx`select r.id, r.project_id, r.status, r.error from workflow_runs r join workflow_runs seed
      on seed.project_id=r.project_id and seed.user_id=r.user_id where seed.id=${anchor}::uuid
      order by r.updated_at desc, r.created_at desc limit 1`;
    if (!run) return { found: false };
    const failed = await tx`select t.role, m.requested_model, m.state as reservation_state
      from agent_tasks t left join lateral (
        select requested_model,state from usage_reservations
        where run_id=t.run_id and task_key=t.key and used_platform_key
        order by created_at desc,id desc limit 1
      ) m on true where t.run_id=${run.id}::uuid and t.status='failed' order by t.updated_at desc limit 8`;
    const [held] = await tx`select count(*)::int as total from usage_reservations
      where project_id=${run.project_id}::uuid and used_platform_key and state='held'`;
    const error = String(run.error ?? "");
    const failure = !error ? null : /مصرف.*نامشخص|مصرف.*مشخص نیست|مصرف.*ثبت/i.test(error) ? "usage_pending"
      : /خروجی مدل|پاسخ مدل|JSON/i.test(error) ? "model_output" : "other";
    return { found: true, status: run.status, failure, project_pending_reservations: held.total,
      failed_roles: failed.map((row) => ({
        role: roles.has(row.role) ? row.role : "unknown",
        last_requested_model: models.has(row.requested_model) ? row.requested_model : null,
        last_reservation_state: ["held", "settled", "released"].includes(row.reservation_state) ? row.reservation_state : null,
      })) };
  });
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error("Model failure inspection stopped. No credentials or private logs printed.");
  process.exitCode = 1;
} finally {
  if (sql) await sql.end({ timeout: 2 }).catch(() => {});
}
