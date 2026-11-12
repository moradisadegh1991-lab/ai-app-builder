import { Sandbox } from "@vercel/sandbox";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import type { AgentContext } from "./orchestrator";
import type { Verification } from "./contracts";

/** Generated code runs as an unprivileged user in a disposable microVM.
 * The snapshot contains trusted tools only; no platform credentials enter it.
 */
export const verifyInVercelSandbox: AgentContext["verify"] = async (
  files,
  template,
  needsBackend,
  signal,
  journeys,
) => {
  const checks: Verification["checks"] = [];
  let log = "";
  let sandbox: Sandbox | undefined;
  const snapshotId = process.env.VERCEL_AGENT_SNAPSHOT_ID;
  if (!snapshotId)
    return { status: "blocked", checks, log: "VERCEL_AGENT_SNAPSHOT_ID تنظیم نشده است.", screenshots: [] };
  try {
    sandbox = await Sandbox.create({
      source: { type: "snapshot", snapshotId },
      persistent: false,
      timeout: 240_000,
      networkPolicy: { allow: ["registry.npmjs.org", "*.npmjs.org"] },
    });
    const vm = sandbox;
    const app = vm.asUser("app");
    const cwd = `${app.homeDir}/project`;
    // The SDK file API runs as ubuntu. Grant that trusted user access to the
    // app's home; app stays outside the ubuntu group and cannot edit runners.
    const permissions = await vm.runCommand({
      cmd: "install",
      args: ["-d", "-o", "app", "-g", "ubuntu", "-m", "0770", app.homeDir, cwd],
      sudo: true,
      signal,
    });
    if (permissions.exitCode) throw new Error("Cannot prepare sandbox app directory");
    for (const file of files) {
      if (!file.path || path.posix.isAbsolute(file.path) || file.path.split("/").includes(".."))
        throw new Error("Unsafe sandbox path");
    }
    await app.writeFiles(
      files.map((file) => ({ path: `${cwd}/${file.path}`, content: file.content })),
      { signal },
    );
    // Trusted runners are owned by ubuntu, outside the generated app's home.
    await vm.writeFiles(
      await Promise.all(
        ["browser.mjs", "serve.mjs"].map(async (name) => ({
          path: `/opt/runner/${name}`,
          content: await readFile(path.join(process.cwd(), "worker", name)),
          mode: 0o644,
        })),
      ),
    );
    const env = { HOME: app.homeDir, CI: "1", EXPO_OFFLINE: "1", npm_config_cache: `${app.homeDir}/.npm` };
    const run = async (cmd: string, args: string[], timeoutMs = 90_000, extraEnv: Record<string, string> = {}) => {
      signal.throwIfAborted();
      const result = await app.runCommand({ cmd, args, cwd, env: { ...env, ...extraEnv }, timeoutMs, signal });
      const output = (await result.output()).slice(-20000);
      log = (log + "\n" + output).slice(-20000);
      return { code: result.exitCode, output };
    };
    const install = await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], 100_000);
    if (install.code)
      return { status: "blocked", checks, log: `Dependency installation failed:\n${log}`, screenshots: [] };
    // App execution begins only after all external network access is removed.
    await vm.updateNetworkPolicy("deny-all");
    const check = async (name: string, cmd: string, args: string[], extraEnv: Record<string, string> = {}) => {
      const result = await run(cmd, args, 60_000, extraEnv);
      checks.push({ name, status: result.code ? "failed" : "passed", detail: result.output.slice(-12000) });
      return result;
    };
    await check("typecheck", "./node_modules/.bin/tsc", ["--noEmit"]);
    if (needsBackend)
      await check("backend-typecheck", "./node_modules/.bin/tsc", [
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "ES2022",
        "--module",
        "ESNext",
        "--moduleResolution",
        "bundler",
        "--esModuleInterop",
        "server/app.ts",
        "server/node.ts",
        "api/index.ts",
      ]);
    await check(
      template === "expo" ? "metro-export" : "build",
      template === "expo" ? "./node_modules/.bin/expo" : "npm",
      template === "expo" ? ["export", "--platform", "android"] : ["run", "build"],
    );
    if (checks.some((c) => c.status === "failed")) return { status: "failed", checks, log, screenshots: [] };
    if (template === "expo") {
      checks.push({
        name: "native-visual",
        status: "skipped",
        detail: "Android emulator required; Metro export and source review only.",
      });
      return { status: "passed", checks, log, screenshots: [] };
    }
    let databaseUrl = "";
    if (needsBackend) {
      const password = randomBytes(24).toString("hex");
      const setup = await vm.runCommand({
        cmd: "bash",
        args: [
          "-lc",
          `set -e
version=$(pg_lsclusters --no-header | awk 'NR==1 {print $1}')
pg_ctlcluster "$version" main start
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE sandbox_app LOGIN PASSWORD '${password}' NOSUPERUSER" -c "CREATE DATABASE app OWNER sandbox_app"`,
        ],
        sudo: true,
        timeoutMs: 20_000,
        signal,
      });
      if (setup.exitCode) throw new Error(`Cannot start isolated PostgreSQL: ${(await setup.output()).slice(-1000)}`);
      databaseUrl = `postgres://sandbox_app:${password}@127.0.0.1:5432/app`;
      await check(
        "database-schema",
        "node",
        [
          "--input-type=module",
          "-e",
          "import postgres from 'postgres'; import {readFile} from 'node:fs/promises'; const sql=postgres(process.env.DATABASE_URL); try {const schema=await readFile('db/schema.sql','utf8');await sql.unsafe(schema);await sql.unsafe(schema);} finally {await sql.end();}",
        ],
        { DATABASE_URL: databaseUrl },
      );
      if (checks.some((c) => c.status === "failed")) return { status: "failed", checks, log, screenshots: [] };
      await app.runCommand({
        cmd: "./node_modules/.bin/tsx",
        args: ["server/node.ts"],
        cwd,
        env: { ...env, DATABASE_URL: databaseUrl },
        detached: true,
      });
    }
    await app.runCommand({
      cmd: "node",
      args: ["/opt/runner/serve.mjs"],
      cwd,
      env: { ...env, SANDBOX_DIST: `${cwd}/dist` },
      detached: true,
    });
    // Wait for both servers from the trusted user; no generated report is read.
    const ready = await vm.runCommand({
      cmd: "node",
      args: [
        "--input-type=module",
        "-e",
        `for(let n=0;n<60;n++){try{const r=await fetch('http://127.0.0.1:4173');if(r.ok){${needsBackend ? "await fetch('http://127.0.0.1:3000/api/health');" : ""}process.exit(0)}}catch{}await new Promise(r=>setTimeout(r,250))}process.exit(1)`,
      ],
      timeoutMs: 20_000,
      signal,
    });
    if (ready.exitCode) throw new Error("Sandbox servers did not start");
    const browser = await vm.runCommand({
      cmd: "node",
      args: ["/opt/runner/browser.mjs"],
      env: {
        JOURNEYS: JSON.stringify(journeys),
        SANDBOX_BASE_URL: "http://127.0.0.1:4173",
        CHROMIUM_PATH: "/opt/runner/chromium",
      },
      timeoutMs: 90_000,
      signal,
    });
    if (browser.exitCode) throw new Error(`Browser runner failed: ${(await browser.stderr()).slice(-1000)}`);
    const result = JSON.parse(await browser.stdout()) as Pick<Verification, "checks" | "screenshots">;
    checks.push(...result.checks);
    return {
      status: checks.some((c) => c.status === "failed") ? "failed" : "passed",
      checks,
      log,
      screenshots: result.screenshots,
    };
  } catch (error) {
    signal.throwIfAborted();
    return { status: "blocked", checks, log: String(error).slice(-2000), screenshots: [] };
  } finally {
    // Stop even after cancellation; the VM timeout is the crash cleanup fallback.
    await sandbox?.stop().catch((error) => console.error("Sandbox cleanup failed", String(error).slice(0, 300)));
  }
};
