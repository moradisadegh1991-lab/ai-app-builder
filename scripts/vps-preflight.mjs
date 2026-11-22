import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Only inspect the variables this diagnostic needs; never print values.
const allowed = new Set(["DATABASE_URL", "APP_URL", "AI_GATEWAY_KIND", "AI_GATEWAY_BASE_URL", "AI_GATEWAY_API_KEY", "AI_TOMAN_LIMITS_JSON", "ARVAN_MODEL_PRICING_JSON", "PRICING_ADMIN_USER_IDS"]);
export function selectEnvironment(raw) {
  const env = {};
  for (const part of raw.split("\0")) {
    const i = part.indexOf("=");
    if (i > 0 && allowed.has(part.slice(0, i))) env[part.slice(0, i)] = part.slice(i + 1);
  }
  return env;
}
export function summarizeEnvironment(env) {
  let database = "unknown";
  try {
    const host = new URL(env.DATABASE_URL).hostname;
    database = host.endsWith(".neon.tech") ? "neon" : ["localhost", "127.0.0.1", "::1"].includes(host) ? "local-postgres" : "other-postgres";
  } catch { /* missing/invalid URL */ }
  return {
    database,
    canonicalUrlMatches: env.APP_URL?.replace(/\/+$/, "") === "https://ideaapp.anzanagenticai.ir",
    arvanSelected: env.AI_GATEWAY_KIND === "arvan",
    gatewayKeyPresent: Boolean(env.AI_GATEWAY_API_KEY),
    budgetConfigPresent: Boolean(env.AI_TOMAN_LIMITS_JSON),
    arvanPriceOverridePresent: Boolean(env.ARVAN_MODEL_PRICING_JSON),
    pricingAdminConfigured: Boolean(env.PRICING_ADMIN_USER_IDS),
  };
}
async function main() {
  const pid = process.argv[2];
  const appDir = process.argv[3] ?? "/opt/moradi-apps/ideaapp";
  if (!/^\d+$/.test(pid ?? "")) throw new Error("Supply the service PID as the first argument.");
  const env = selectEnvironment(await readFile(`/proc/${pid}/environ`, "utf8"));
  const requireFromApp = createRequire(resolve(appDir, "package.json"));
  // Next.js may have loaded .env.local inside the process after startup, which
  // is not reflected by /proc. Follow Next's own environment precedence.
  for (const key of allowed) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  const nextEnv = requireFromApp("@next/env");
  nextEnv.loadEnvConfig(appDir, false, { info() {}, warn() {}, error() {} });
  const selected = Object.fromEntries([...allowed].map(key => [key, process.env[key]]));
  const report = { environment: summarizeEnvironment(selected), database: { reachable: null, inspection: "not-attempted" } };
  if (!selected.DATABASE_URL) { console.log(JSON.stringify(report, null, 2)); return; }
  let sql;
  try {
    const postgres = requireFromApp("postgres");
    sql = postgres(selected.DATABASE_URL, { max: 1, connect_timeout: 8, idle_timeout: 1, prepare: false });
    const [objects] = await sql`select to_regclass('drizzle.__drizzle_migrations') is not null as journal,
      to_regclass('public.visual_projects') is not null as visual_projects,
      to_regclass('public.ai_tariffs') is not null as ai_tariffs,
      exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='reserve_ai_money') as money_guard,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='usage_records' and column_name='estimated_cost_toman') as cost_column,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='usage_records' and column_name='reservation_id') as reservation_link,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='usage_reservations' and column_name='reserved_toman') as money_holds`;
    report.database = { reachable: true, ...objects };
    if (objects.journal) {
      const [row] = await sql`select max(created_at)::text as latest from drizzle.__drizzle_migrations`;
      report.database.latestMigrationTimestamp = row.latest;
    }
    if (objects.cost_column && objects.reservation_link && objects.money_holds) {
      const [row] = await sql`select count(*)::int as count from usage_records u
        where u.used_platform_key and u.created_at >= now()-interval '30 days' and
          (u.estimated_cost_toman is null or u.reservation_id is null or not exists
            (select 1 from usage_reservations x where x.id=u.reservation_id and x.reserved_toman is not null))`;
      const [holds] = await sql`select count(*)::int as count from usage_reservations u
        where u.used_platform_key and u.state='held' and u.created_at >= now()-interval '30 days' and u.reserved_toman is null`;
      report.database.recentUnpricedRecords = row.count;
      report.database.recentUnpricedHolds = holds.count;
    }
  } catch {
    // Driver errors may include connection details. Do not print them.
    report.database = { reachable: null, inspection: "failed" };
  } finally {
    if (sql) await sql.end({ timeout: 2 }).catch(() => undefined);
  }
  console.log(JSON.stringify(report, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error("Preflight failed; verify PID and installation path privately."); process.exitCode = 1; });
