import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { AgentContext } from "./orchestrator";
import type { Verification } from "./contracts";

interface CommandResult {
  code: number;
  output: string;
}
export function command(
  program: string,
  args: string[],
  signal?: AbortSignal,
  timeout = 240_000,
  maxBytes = 80_000,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      stdio: ["ignore", "pipe", "pipe"],
      signal,
    });
    let output = "";
    const append = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-maxBytes);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
  });
}

/** Only a dedicated worker imports this module. Never run generated code on the web server. */
export const verifyInSandbox: AgentContext["verify"] = async (files, template, needsBackend, signal, journeys) => {
  const checks: Verification["checks"] = [];
  let log = "";
  const suffix = randomBytes(8).toString("hex");
  const network = `i2a-${suffix}`,
    app = `i2a-app-${suffix}`,
    postgres = `i2a-db-${suffix}`;
  const containers: string[] = [];
  const dir = await mkdtemp(path.join(os.tmpdir(), "i2a-verify-"));
  const image = process.env.AGENT_SANDBOX_IMAGE ?? "idea2app-sandbox:1";
  const buildImage = process.env.AGENT_BUILD_IMAGE ?? "idea2app-build:1";
  const base = [
    "run",
    "--rm",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=256",
    "--memory=2g",
    "--cpus=2",
    "--tmpfs=/tmp:rw,nosuid,size=256m",
    "--user",
    `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    "-v",
    `${dir}:/work`,
    "-w",
    "/work",
    "-e",
    "HOME=/tmp",
    "-e",
    "npm_config_cache=/tmp/npm",
    "-e",
    "CI=1",
    "-e",
    "EXPO_OFFLINE=1",
  ];
  const docker = async (args: string[], maxBytes = 80_000) => command("docker", args, signal, 240_000, maxBytes);
  try {
    const ready = await docker(["image", "inspect", image]);
    if (ready.code)
      return {
        status: "blocked",
        checks,
        log: `تصویر ${image} نصب نیست. worker/Dockerfile را روی میزبان Worker بسازید.`,
        screenshots: [],
      };
    if ((await docker(["image", "inspect", buildImage])).code)
      return {
        status: "blocked",
        checks,
        log: `تصویر ${buildImage} نصب نیست. worker/Build.Dockerfile را بسازید.`,
        screenshots: [],
      };
    for (const file of files) {
      const target = path.resolve(dir, file.path);
      if (!target.startsWith(dir + path.sep)) throw new Error("Unsafe sandbox path");
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content);
    }
    // Installation is the only networked phase. Template-owned package.json and disabled
    // lifecycle scripts prevent app code from running with network/proxy access here.
    const installName = `i2a-install-${suffix}`;
    containers.push(installName);
    const ca = process.env.AGENT_NPM_CA_FILE;
    const install = await docker([
      ...base,
      "--name",
      installName,
      ...(ca ? ["-v", `${path.resolve(ca)}:/run/npm-ca.pem:ro`, "-e", "NODE_EXTRA_CA_CERTS=/run/npm-ca.pem"] : []),
      buildImage,
      "npm",
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ]);
    log += install.output;
    if (install.code)
      return {
        status: "blocked",
        checks,
        log: `Dependency installation failed:\n${log.slice(-15000)}`,
        screenshots: [],
      };
    const typeName = `i2a-types-${suffix}`;
    containers.push(typeName);
    const typecheck = await docker([
      ...base,
      "--name",
      typeName,
      "--network=none",
      buildImage,
      "./node_modules/.bin/tsc",
      "--noEmit",
    ]);
    checks.push({
      name: "typecheck",
      status: typecheck.code ? "failed" : "passed",
      detail: typecheck.output.slice(-12000),
    });
    log += typecheck.output;
    if (needsBackend) {
      const backendName = `i2a-backend-types-${suffix}`;
      containers.push(backendName);
      const result = await docker([
        ...base,
        "--name",
        backendName,
        "--network=none",
        buildImage,
        "./node_modules/.bin/tsc",
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
      checks.push({
        name: "backend-typecheck",
        status: result.code ? "failed" : "passed",
        detail: result.output.slice(-12000),
      });
      log += result.output;
    }
    const buildName = `i2a-build-${suffix}`;
    containers.push(buildName);
    const build = await docker([
      ...base,
      "--name",
      buildName,
      "--network=none",
      buildImage,
      ...(template === "expo"
        ? ["./node_modules/.bin/expo", "export", "--platform", "android"]
        : ["npm", "run", "build"]),
    ]);
    checks.push({
      name: template === "expo" ? "metro-export" : "build",
      status: build.code ? "failed" : "passed",
      detail: build.output.slice(-12000),
    });
    log += build.output;
    if (checks.some((c) => c.status === "failed"))
      return {
        status: "failed",
        checks,
        log: log.slice(-20000),
        screenshots: [],
      };
    if (template === "expo") {
      checks.push({
        name: "native-visual",
        status: "skipped",
        detail:
          "Native screenshots and APK execution require an Android emulator; Metro export and source review only.",
      });
      return {
        status: "passed",
        checks,
        log: log.slice(-20000),
        screenshots: [],
      };
    }
    if ((await docker(["network", "create", "--internal", network])).code)
      throw new Error("Cannot create isolated Docker network");
    let databaseUrl = "";
    if (needsBackend) {
      const password = randomBytes(16).toString("hex");
      const appPassword = randomBytes(16).toString("hex");
      containers.push(postgres);
      const dbStart = await docker([
        "run",
        "--rm",
        "-d",
        "--name",
        postgres,
        "--network",
        network,
        "--network-alias",
        "db",
        "--memory=512m",
        "--pids-limit=100",
        "-e",
        `POSTGRES_PASSWORD=${password}`,
        "postgres:17-alpine",
      ]);
      if (dbStart.code) throw new Error("Cannot start sandbox PostgreSQL (pre-pull postgres:17-alpine)");
      let ready = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        if ((await docker(["exec", postgres, "pg_isready", "-U", "postgres"])).code === 0) {
          ready = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!ready) throw new Error("Sandbox PostgreSQL did not start");
      const setup = await docker([
        "exec",
        postgres,
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `CREATE ROLE sandbox_app LOGIN PASSWORD '${appPassword}' NOSUPERUSER;`,
        "-c",
        "CREATE DATABASE app OWNER sandbox_app;",
      ]);
      if (setup.code) throw new Error("Cannot initialize sandbox database");
      databaseUrl = `postgres://sandbox_app:${appPassword}@db:5432/app`;
      const schemaName = `i2a-schema-${suffix}`;
      containers.push(schemaName);
      const schema = await docker([
        ...base,
        "--name",
        schemaName,
        "--network",
        network,
        "-e",
        `DATABASE_URL=${databaseUrl}`,
        buildImage,
        "node",
        "--input-type=module",
        "-e",
        "import postgres from 'postgres'; import {readFile} from 'node:fs/promises'; const sql=postgres(process.env.DATABASE_URL); try {const schema=await readFile('db/schema.sql','utf8');await sql.unsafe(schema);await sql.unsafe(schema);} finally {await sql.end();}",
      ]);
      checks.push({
        name: "database-schema",
        status: schema.code ? "failed" : "passed",
        detail: schema.output.slice(-8000),
      });
      if (schema.code)
        return {
          status: "failed",
          checks,
          log: schema.output.slice(-15000),
          screenshots: [],
        };
    }
    containers.push(app);
    const start = await docker([
      ...base,
      "-d",
      "--name",
      app,
      "--network",
      network,
      "--network-alias",
      "app",
      "-v",
      `${path.resolve("worker/serve.mjs")}:/opt/runner/serve.mjs:ro`,
      "-e",
      `DATABASE_URL=${databaseUrl}`,
      buildImage,
      "sh",
      "-c",
      needsBackend
        ? "./node_modules/.bin/tsx server/node.ts & node /opt/runner/serve.mjs"
        : "node /opt/runner/serve.mjs",
    ]);
    if (start.code) throw new Error("Cannot start sandbox app");
    const browserName = `i2a-browser-${suffix}`;
    containers.push(browserName);
    const browser = await docker(
      [
        "run",
        "--rm",
        "--name",
        browserName,
        "--network",
        network,
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit=256",
        "--memory=1g",
        "--tmpfs=/tmp:rw,nosuid,size=512m",
        "--user",
        `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        "-v",
        `${path.resolve("worker/browser.mjs")}:/opt/runner/browser.mjs:ro`,
        "-e",
        "HOME=/tmp",
        "-e",
        `JOURNEYS=${JSON.stringify(journeys)}`,
        image,
        "node",
        "/opt/runner/browser.mjs",
      ],
      6_000_000,
    );
    if (browser.code) throw new Error(`Browser runner failed: ${browser.output.slice(-1000)}`);
    const result = JSON.parse(browser.output) as Pick<Verification, "checks" | "screenshots">;
    checks.push(...result.checks);
    return {
      status: checks.some((c) => c.status === "failed") ? "failed" : "passed",
      checks,
      log: log.slice(-20000),
      screenshots: result.screenshots,
    };
  } catch (error) {
    signal.throwIfAborted();
    return {
      status: "blocked",
      checks,
      log: String(error).slice(-2000),
      screenshots: [],
    };
  } finally {
    // Cleanup also runs after cancellation; never reuse an aborted signal here.
    await Promise.allSettled(containers.map((name) => command("docker", ["rm", "-f", name], undefined, 15000)));
    await command("docker", ["network", "rm", network], undefined, 15000).catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  }
};
