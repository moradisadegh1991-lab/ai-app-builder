import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, statfsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const app = "/opt/moradi-apps/ideaapp";
const web = "moradi-ideaapp.service";
const worker = "moradi-ideaapp-code-worker.service";
const [runId, mode] = process.argv.slice(2);
const checks = new Set(["source-contract", "render", "typecheck", "backend-typecheck", "build",
  "metro-export", "database-schema", "browser", "runtime-desktop", "runtime-mobile"]);
const blockers = new Set(["docker_access", "image_missing", "packages_unavailable", "package_missing", "package_install",
  "capacity", "preview_database", "browser", "runner_unavailable", "unknown"]);

function system(command, ...args) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 5000 });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function serviceEnv(service) {
  const pid = system("systemctl", "show", service, "-p", "MainPID", "--value");
  if (!/^[1-9]\d*$/.test(pid ?? "")) return {};
  const entries = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
  return Object.fromEntries(entries.filter((line) => line.includes("=")).map((line) => {
    const divider = line.indexOf("=");
    return [line.slice(0, divider), line.slice(divider + 1)];
  }));
}

function signalCodes(text) {
  const patterns = {
    invalid_runner_json: /SyntaxError:.*(?:JSON|Unexpected token)|Unexpected end of JSON/i,
    storage_full: /ENOSPC|no space left on device/i,
    permission_denied: /EACCES|EPERM|permission denied|read-only file system/i,
    image_missing: /no such image|manifest unknown|تصویر .*نصب نیست/i,
    network: /EAI_AGAIN|ECONNRESET|ETIMEDOUT|ENOTFOUND|ERR_SOCKET_TIMEOUT|network is unreachable|socket hang up/i,
    package_version_missing: /ETARGET|No matching version found/i,
    registry_certificate: /CERT_HAS_EXPIRED|SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE|certificate verification failed/i,
    runner_memory: /out of memory|heap limit|cannot allocate memory|OOMKilled/i,
    worker_timeout: /timed out|TimeoutError|timeout exceeded/i,
    browser_launch: /browserType\.launch|Target page, context or browser has been closed|Browser runner failed/i,
    preview_database: /Sandbox PostgreSQL did not start|Cannot initialize sandbox database|Cannot start sandbox PostgreSQL/i,
  };
  return Object.entries(patterns).filter(([, pattern]) => pattern.test(text)).map(([code]) => code);
}

async function workflowSnapshot(env) {
  const requireFromApp = createRequire(`${app}/package.json`);
  delete process.env.DATABASE_URL;
  if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
  requireFromApp("@next/env").loadEnvConfig(app, false, { info() {}, error() {} });
  const url = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("database is not local");
  const db = requireFromApp("postgres")(process.env.DATABASE_URL, { max: 1, connect_timeout: 8, prepare: false });
  try {
    return await db.begin("read only", async (tx) => {
      const [run] = await tx`select r.status, r.attempts, r.updated_at, r.retry_after,
          p.template, p.spec->>'needsBackend' as needs_backend
        from workflow_runs r join projects p on p.id=r.project_id where r.id=${runId}::uuid`;
      if (!run) return { found: false };
      const [check] = await tx`select status,output from agent_tasks where run_id=${runId}::uuid and role='verifier'
        order by updated_at desc limit 1`;
      const [evaluation] = await tx`select report->'verification' as result from evaluations
        where run_id=${runId}::uuid order by round desc limit 1`;
      const detail = evaluation?.result ?? check?.output;
      const available = Array.isArray(detail?.checks) ? detail.checks : [];
      const logs = [detail?.log, check?.output?.log, ...available.map((entry) => entry?.detail)]
        .filter((part) => typeof part === "string").join("\n");
      return {
        found: true,
        status: run.status,
        attempts: run.attempts,
        updated_at: run.updated_at,
        retry_after: run.status === "queued" ? run.retry_after : null,
        verifier_status: check?.status ?? null,
        verifier_result: ["blocked", "failed", "passed"].includes(detail?.status) ? detail.status : null,
        blocker: blockers.has(detail?.blocker) ? detail.blocker : null,
        check_states: available.filter(({name, status}) => checks.has(name) && ["passed", "failed", "skipped"].includes(status))
          .map(({name, status}) => ({name, status})),
        log_signals: signalCodes(logs),
        needs_backend: run.needs_backend === "true",
        template: ["web", "expo", "capacitor"].includes(run.template) ? run.template : "web",
      };
    });
  } finally {
    await db.end({ timeout: 2 }).catch(() => {});
  }
}

// A fixed repository sample, without calling a model, posting workflow requests, or using production credentials.
const probe = `
import { readFile } from "node:fs/promises";
import { renderProject } from "./src/lib/templates/index.ts";
import { appSpecSchema } from "./src/lib/spec.ts";
import { verifyInSandbox } from "./src/lib/agents/sandbox.ts";

const backend = process.argv[2] === "true";
const template = process.argv[3];
const stop = new AbortController();
process.once("SIGTERM", () => stop.abort());
const spec = appSpecSchema.parse({
  appName: "Sandbox diagnostics", summary: "Sandbox environment test", language: "fa",
  needsBackend: backend, features: ["Probe"], screens: [{ name: "خانه", purpose: "نمونه" }],
});
const read = (name) => readFile("scripts/samples/" + name, "utf8");
const aiFiles = [{ path: "src/App.tsx", content: await read(backend ? "web-App.tsx" : "capacitor-App.tsx") }];
if (backend) aiFiles.push(
  { path: "server/app.ts", content: await read("server-app.ts") },
  { path: "db/schema.sql", content: await read("schema.sql") },
);
try {
  const { files } = renderProject({ template, slug: "sandbox-diagnostics", spec, aiFiles, requestedLibraries: [] });
  const result = await verifyInSandbox(files, template, backend, stop.signal, []);
  const allowed = new Set(${JSON.stringify([...checks])});
  console.log(JSON.stringify({ status: result.status, blocker: result.blocker ?? null,
    check_states: result.checks.filter(({name}) => allowed.has(name)).map(({name, status}) => ({name, status})) }));
} catch (error) {
  console.log(JSON.stringify({ status: "probe_failed", error_type: error instanceof SyntaxError ? "syntax" : "runtime" }));
  process.exitCode = 1;
}
`;

async function main() {
  if (process.getuid?.() !== 0 || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(runId ?? "") ||
      (mode !== undefined && mode !== "--probe")) throw new Error("invalid invocation");
  const state = await workflowSnapshot(serviceEnv(web));
  console.log(JSON.stringify(state, null, 2));
  if (!state.found || state.status !== "failed" || mode !== "--probe") return;
  const user = system("systemctl", "show", worker, "-p", "User", "--value");
  const group = system("systemctl", "show", worker, "-p", "Group", "--value");
  const groups = system("systemctl", "show", worker, "-p", "SupplementaryGroups", "--value");
  if (user !== "ideaappcode" || group !== "moradiidea" || !groups?.split(/\s+/).includes("docker")) {
    console.log(JSON.stringify({ probe: "worker_service_unavailable" }));
    return;
  }
  const disk = statfsSync("/tmp");
  if (disk.bavail * disk.bsize < 512 * 1024 * 1024) {
    console.log(JSON.stringify({ probe: "low_disk_space" }));
    return;
  }
  const env = serviceEnv(worker);
  const allow = ["AGENT_USE_LIARA_NPM_MIRROR", "AGENT_SANDBOX_IMAGE", "AGENT_BUILD_IMAGE", "AGENT_NPM_CA_FILE"];
  console.log("Running a fixed sandbox sample without an AI call...");
  const result = spawnSync("systemd-run", [
    "--quiet", "--wait", "--pipe", "--collect",
    `--unit=ideaapp-verifier-probe-${randomUUID()}`,
    "-p", "User=ideaappcode", "-p", "Group=moradiidea", "-p", "SupplementaryGroups=docker",
    "-p", `WorkingDirectory=${app}`, "-p", "ProtectSystem=strict", "-p", "ReadWritePaths=/tmp",
    "-p", "NoNewPrivileges=true", "-p", "ProtectHome=true", "-p", "MemoryMax=1200M", "-p", "TasksMax=128",
    "-p", "RuntimeMaxSec=300", "-p", "TimeoutStopSec=25",
    "--setenv=NODE_ENV=production",
    ...allow.filter((key) => env[key]).map((key) => `--setenv=${key}=${env[key]}`),
    process.execPath, "--import", "tsx", "--input-type=module", "-", String(state.needs_backend), state.template,
  ], {
    input: probe, encoding: "utf8", maxBuffer: 128 * 1024, timeout: 335_000,
    env: { PATH: process.env.PATH, LANG: process.env.LANG ?? "C.UTF-8" },
  });
  try {
    const last = JSON.parse((result.stdout ?? "").trim().split("\n").at(-1));
    console.log(JSON.stringify({ probe: last.status, blocker: blockers.has(last.blocker) ? last.blocker : null,
      check_states: last.check_states ?? [], log_signals: signalCodes(result.stderr ?? "") }, null, 2));
  } catch {
    console.log(JSON.stringify({ probe: "could_not_run", log_signals: signalCodes(result.stderr ?? ""),
      timed_out: result.error?.code === "ETIMEDOUT" }));
  }
}
main().catch(() => {
  console.error("Verifier diagnostics stopped before completion. No credentials or raw logs were printed.");
  process.exitCode = 1;
});
