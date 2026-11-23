#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
worker=moradi-ideaapp-code-worker.service
release=https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/88b494cd1a533e37b2c61f43e804c7b5b03f1300/deploy/patches

if [[ $(id -u) != 0 || ! -d "$app/node_modules" ]]; then
  echo 'Run from the VPS root console.' >&2
  exit 1
fi
systemctl is-active --quiet "$worker"
[[ $(systemctl show "$worker" -p User --value) == ideaappcode ]]
[[ $(systemctl show "$worker" -p Group --value) == moradiidea ]]
[[ " $(systemctl show "$worker" -p SupplementaryGroups --value) " == *' docker '* ]]
exec 9>/run/lock/ideaapp-browser-probe.lock
flock -n 9 || { echo 'A browser probe is already running.' >&2; exit 1; }

stage=$(mktemp -d /tmp/ideaapp-browser.XXXXXX)
echo "Browser patch staging: $stage"
patch="$stage/browser-report-streams.patch"
curl -fsSL "$release/browser-report-streams.patch" -o "$patch"
printf '%s  %s\n' b24b9134ebc8920d4c73ce4dac662759098266569f3babfb0fbffcd08d46b09b "$patch" | sha256sum -c
git -C "$app" apply --check "$patch"
tar -C "$app" -cf - src worker scripts/samples package.json tsconfig.json |
  tar --no-same-owner --no-same-permissions --no-overwrite-dir -xf - -C "$stage"
git -C "$stage" apply "$patch"
chgrp -R moradiidea "$stage"
chmod -R u+rwX,g+rX,g-w,o-rwx "$stage"
ln -s "$app/node_modules" "$stage/node_modules"
log="$stage/probe.log"

if ! systemd-run --quiet --wait --pipe --collect \
  -p User=ideaappcode -p Group=moradiidea -p SupplementaryGroups=docker \
  -p "WorkingDirectory=$stage" -p ProtectSystem=strict -p ReadWritePaths=/tmp \
  -p NoNewPrivileges=true -p ProtectHome=true -p MemoryMax=1200M -p TasksMax=128 \
  -p RuntimeMaxSec=300 -p TimeoutStopSec=25 \
  --setenv=NODE_ENV=production --setenv=AGENT_USE_LIARA_NPM_MIRROR=1 \
  "$(command -v node)" --import tsx --input-type=module - >"$log" 2>/dev/null <<'JS'
import { readFile } from "node:fs/promises";
import { renderProject } from "./src/lib/templates/index.ts";
import { appSpecSchema } from "./src/lib/spec.ts";
import { verifyInSandbox } from "./src/lib/agents/sandbox.ts";

const spec = appSpecSchema.parse({
  appName: "Sandbox diagnostics", summary: "Sandbox environment test", language: "fa",
  needsBackend: true, features: ["Probe"], screens: [{ name: "خانه", purpose: "نمونه" }],
});
const samples = [["src/App.tsx", "web-App.tsx"], ["server/app.ts", "server-app.ts"], ["db/schema.sql", "schema.sql"]];
const aiFiles = await Promise.all(samples.map(async ([path, name]) => ({
  path, content: await readFile(`scripts/samples/${name}`, "utf8"),
})));
const stop = new AbortController();
process.once("SIGTERM", () => stop.abort());
const { files } = renderProject({ template: "web", slug: "sandbox-diagnostics", spec, aiFiles, requestedLibraries: [] });
const result = await verifyInSandbox(files, "web", true, stop.signal, []);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker ?? null,
  checks: result.checks.map(({ name, status }) => ({ name, status })),
}, null, 2));
if (result.status !== "passed") process.exitCode = 1;
JS
then
  cat "$log"
  echo 'Candidate verification did not pass. The live worker was not changed.' >&2
  exit 1
fi
cat "$log"
echo "Browser patch verified: $stage"
