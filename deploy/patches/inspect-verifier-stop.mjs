const verificationFailures = {
  docker_access: { detail: "\u0633\u0631\u0648\u06CC\u0633 \u0628\u0631\u0631\u0633\u06CC \u0628\u0647 \u0645\u062D\u06CC\u0637 \u0627\u062C\u0631\u0627\u06CC \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u062F\u0633\u062A\u0631\u0633\u06CC \u0646\u062F\u0627\u0631\u062F.", retry: false },
  image_missing: { detail: "\u06CC\u06A9\u06CC \u0627\u0632 \u0627\u0628\u0632\u0627\u0631\u0647\u0627\u06CC \u0644\u0627\u0632\u0645 \u0628\u0631\u0627\u06CC \u0645\u062D\u06CC\u0637 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0631\u0648\u06CC \u0633\u0631\u0648\u0631 \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A.", retry: false },
  packages_unavailable: { detail: "\u062F\u0631\u06CC\u0627\u0641\u062A \u0628\u0633\u062A\u0647\u200C\u0647\u0627\u06CC \u0644\u0627\u0632\u0645 \u0628\u0631\u0627\u06CC \u0628\u0631\u0631\u0633\u06CC \u067E\u0631\u0648\u0698\u0647 \u0645\u0648\u0642\u062A\u0627\u064B \u0642\u0637\u0639 \u0634\u062F\u0647 \u0627\u0633\u062A.", retry: true },
  package_missing: { detail: "\u06CC\u06A9\u06CC \u0627\u0632 \u0628\u0633\u062A\u0647\u200C\u0647\u0627\u06CC \u0644\u0627\u0632\u0645 \u062F\u0631 \u0645\u0646\u0628\u0639 \u0628\u0633\u062A\u0647\u200C\u0647\u0627\u06CC \u067E\u0644\u062A\u0641\u0631\u0645 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.", retry: false },
  package_install: { detail: "\u067E\u0644\u062A\u0641\u0631\u0645 \u0646\u062A\u0648\u0627\u0646\u0633\u062A \u0628\u0633\u062A\u0647\u200C\u0647\u0627\u06CC \u0644\u0627\u0632\u0645 \u0628\u0631\u0627\u06CC \u0628\u0631\u0631\u0633\u06CC \u067E\u0631\u0648\u0698\u0647 \u0631\u0627 \u0622\u0645\u0627\u062F\u0647 \u06A9\u0646\u062F.", retry: false },
  capacity: { detail: "\u0645\u062D\u06CC\u0637 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0628\u0627 \u06A9\u0645\u0628\u0648\u062F \u0645\u0646\u0627\u0628\u0639 \u0631\u0648\u0628\u0647\u200C\u0631\u0648 \u0634\u062F.", retry: true },
  preview_database: { detail: "\u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0645\u0648\u0642\u062A \u0628\u0631\u0631\u0633\u06CC \u0622\u0645\u0627\u062F\u0647 \u0646\u0634\u062F.", retry: true },
  browser: { detail: "\u0645\u0631\u0648\u0631\u06AF\u0631 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0646\u062A\u0648\u0627\u0646\u0633\u062A \u0628\u0631\u0631\u0633\u06CC \u067E\u0631\u0648\u0698\u0647 \u0631\u0627 \u0622\u063A\u0627\u0632 \u06A9\u0646\u062F.", retry: true },
  runner_unavailable: { detail: "\u0645\u062D\u06CC\u0637 \u0627\u062C\u0631\u0627\u06CC \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0645\u0648\u0642\u062A\u0627\u064B \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u062F.", retry: true },
  unknown: { detail: "\u067E\u0644\u062A\u0641\u0631\u0645 \u0646\u062A\u0648\u0627\u0646\u0633\u062A \u0628\u0631\u0631\u0633\u06CC \u0641\u0646\u06CC \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646\u062F.", retry: false }
};
function classifyVerificationBlocker(log, stage) {
  if (/permission denied.*docker|docker.*permission denied|docker daemon socket|spawn docker ENOENT|docker:.*not found/i.test(log)) return "docker_access";
  if (/no such image|image.*(?:missing|not found)|تصویر .*نصب نیست|manifest unknown|pre-pull postgres/i.test(log)) return "image_missing";
  if (/no space left|out of memory|cannot allocate memory|exited with code 137/i.test(log)) return "capacity";
  if (/cannot connect to the docker daemon|docker daemon.*not running|error during connect|Cannot create isolated Docker network/i.test(log)) return "runner_unavailable";
  if (stage === "install" || /dependency installation failed/i.test(log)) {
    if (/ETARGET|E404|no matching version|404 not found/i.test(log)) return "package_missing";
    if (/EAI_AGAIN|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|E(?:5\d\d|429)|5\d\d (?:bad gateway|service unavailable|gateway timeout)|command timed out/i.test(log)) return "packages_unavailable";
    return "package_install";
  }
  if (stage === "database" || /sandbox (?:postgresql|database)/i.test(log)) return "preview_database";
  if (stage === "browser" || /browser runner failed|cannot start sandbox app/i.test(log)) return "browser";
  if (stage === "runner" || /command timed out/i.test(log)) return "runner_unavailable";
  return "unknown";
}
function verificationMessage(blocker) {
  return `${verificationFailures[blocker].detail} \u0645\u0631\u0627\u062D\u0644 \u0627\u0646\u062C\u0627\u0645\u200C\u0634\u062F\u0647 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F\u0647\u200C\u0627\u0646\u062F. \u0627\u06AF\u0631 \u0645\u0634\u06A9\u0644 \u0627\u062F\u0627\u0645\u0647 \u062F\u0627\u0634\u062A\u060C \u0634\u0646\u0627\u0633\u0647\u0654 \u0627\u062C\u0631\u0627 \u0631\u0627 \u0628\u0647 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u067E\u0644\u062A\u0641\u0631\u0645 \u0628\u062F\u0647\u06CC\u062F.`;
}
class VerificationBlockedError extends Error {
  constructor(blocker) {
    super(verificationMessage(blocker));
    this.blocker = blocker;
  }
  blocker;
}
export {
  VerificationBlockedError,
  classifyVerificationBlocker,
  verificationFailures,
  verificationMessage
};

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const [pid, runId] = process.argv.slice(2);
let sql;
try {
  if (!/^[1-9]\d*$/.test(pid ?? "") || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(runId ?? ""))
    throw Error("invalid input");
  const app = "/opt/moradi-apps/ideaapp";
  const require = createRequire(`${app}/package.json`);
  delete process.env.DATABASE_URL;
  const dbEnv = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").find((entry) => entry.startsWith("DATABASE_URL="));
  if (dbEnv) process.env.DATABASE_URL = dbEnv.slice("DATABASE_URL=".length);
  require("@next/env").loadEnvConfig(app, false, { info() {}, error() {} });
  const url = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw Error("not local PostgreSQL");
  sql = require("postgres")(process.env.DATABASE_URL, { max: 1, connect_timeout: 8, prepare: false });
  const result = await sql.begin("read only", async (tx) => {
    const [run] = await tx`select status from workflow_runs where id=${runId}::uuid`;
    if (!run) return { found: false };
    const [stage] = await tx`select report->'verification' as result from evaluations
      where run_id=${runId}::uuid and report->'verification'->>'status'='blocked' order by round desc limit 1`;
    const [task] = await tx`select output as result from agent_tasks
      where run_id=${runId}::uuid and role='verifier' and output->>'status'='blocked' order by updated_at desc limit 1`;
    const verification = stage?.result ?? task?.result;
    const blocker = verification && Object.hasOwn(verificationFailures, verification.blocker)
      ? verification.blocker
      : classifyVerificationBlocker(verification?.log || task?.result?.log || "");
    return { found: true, workflow_status: run.status, blocker, explanation: verificationFailures[blocker].detail, transient: verificationFailures[blocker].retry };
  });
  console.log(JSON.stringify(result, null, 2));
} catch {
  console.error("Verifier inspection failed. No credentials or raw logs printed.");
  process.exitCode = 1;
} finally {
  if (sql) await sql.end({ timeout: 2 }).catch(() => {});
}
