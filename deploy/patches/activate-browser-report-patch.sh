#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

app=/opt/moradi-apps/ideaapp
worker=moradi-ideaapp-code-worker.service
web=moradi-ideaapp.service
stage=${1:?Usage: activate-browser-report-patch.sh /tmp/ideaapp-browser.XXXXXX [--check|--activate]}
mode=${2:---check}
file=src/lib/agents/sandbox.ts

fail_preflight() {
  printf 'Preflight stopped: %s. Live worker was not changed.\n' "$*" >&2
  exit 1
}
[[ "$mode" == --check || "$mode" == --activate ]] || fail_preflight 'unexpected mode'
[[ $(id -u) == 0 ]] || fail_preflight 'run from the root console'
[[ "$stage" =~ ^/tmp/ideaapp-browser\.[a-zA-Z0-9]+$ && -d "$stage" && $(realpath "$stage") == "$stage" ]] ||
  fail_preflight 'invalid or missing stage directory'
[[ $(stat -c '%U:%G:%a' "$stage") == root:moradiidea:750 ]] ||
  fail_preflight 'unexpected stage owner or permissions'
for artifact in browser-report-streams.patch probe.log "$file"; do
  [[ -s "$stage/$artifact" && ! -L "$stage/$artifact" ]] || fail_preflight "missing stage artifact: $artifact"
done
[[ -f "$app/$file" && ! -L "$app/$file" ]] || fail_preflight 'live worker source missing'
for service in "$web" "$worker"; do
  systemctl is-active --quiet "$service" || fail_preflight "inactive service: $service"
  [[ $(systemctl show "$service" -p WorkingDirectory --value) == "$app" ]] ||
    fail_preflight "unexpected working directory: $service"
done
[[ $(systemctl show "$worker" -p User --value) == ideaappcode &&
   $(systemctl show "$worker" -p Group --value) == moradiidea ]] || fail_preflight 'unexpected worker account'
if [[ "$mode" == --activate ]]; then
  exec 9>/run/lock/ideaapp-recovery-deploy.lock
  flock -n 9 || fail_preflight 'another deployment is running'
fi

verify=$(mktemp -d /tmp/ideaapp-browser-rollout.XXXXXX)
trap 'rm -rf -- "$verify"' EXIT
patch="$verify/browser.patch"
cp "$stage/browser-report-streams.patch" "$patch"
printf '%s  %s\n' b24b9134ebc8920d4c73ce4dac662759098266569f3babfb0fbffcd08d46b09b "$patch" | sha256sum -c
node --input-type=module - "$stage/probe.log" <<'JS'
import { readFileSync } from "node:fs";
const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
const required = ["typecheck", "backend-typecheck", "build", "database-schema",
  "render-desktop", "layout-desktop", "runtime-desktop", "render-mobile", "layout-mobile", "runtime-mobile"];
const passed = new Set(report.checks.filter((check) => check.status === "passed").map((check) => check.name));
if (report.status !== "passed" || report.blocker !== null || required.some((check) => !passed.has(check))) {
  console.error("Candidate sandbox report is missing required passing checks.");
  process.exit(1);
}
console.log("All 10 candidate sandbox checks passed.");
JS
mkdir -p "$verify/$(dirname "$file")"
cp -a "$app/$file" "$verify/$file"
git -C "$verify" apply --check "$patch"
git -C "$verify" apply "$patch"
cmp -s "$verify/$file" "$stage/$file" || fail_preflight 'patched source differs from the tested version'

identity="$verify/identity.mjs"
curl -fsSL https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/9ccaee20a0d21fc89faeddc26ee2f1478cdb4721/deploy/patches/inspect-developer-identity.mjs -o "$identity"
printf '%s  %s\n' 6eb1f4777d8bee54b11021296e787a44dfbb0796614b302fa48a8b9b3b6e6b9d "$identity" | sha256sum -c
check_idle() {
  node "$identity" "$(systemctl show "$web" -p MainPID --value)" | node --input-type=module -e '
    let data = "";
    for await (const part of process.stdin) data += part;
    const info = JSON.parse(data);
    console.log(JSON.stringify({active_workflows: info.active_workflows}));
    if (info.active_workflows !== 0) process.exit(1);
  '
}
check_idle || fail_preflight 'wait for active workflows to finish and retry'
if [[ "$mode" == --check ]]; then
  echo 'Browser patch preflight passed.'
  exit 0
fi

backup=$(mktemp -d /root/ideaapp-before-browser-report.XXXXXX)
cp -a "$app/$file" "$backup/sandbox.ts"
changed=0
rollback() {
  local code=$1
  trap - ERR INT TERM
  if (( ! changed )); then
    echo "Worker source was not changed. Backup: $backup" >&2
    exit "$code"
  fi
  mkdir "$backup/rollback.lock" 2>/dev/null || exit "$code"
  if cp -a --remove-destination "$backup/sandbox.ts" "$app/$file" &&
     systemctl restart "$worker" && systemctl is-active --quiet "$worker"; then
    echo "Previous worker restored. Backup: $backup"
  else
    echo "Worker rollback needs attention. Backup: $backup" >&2
  fi
  exit "$code"
}
trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM

new=$(mktemp "$app/src/lib/agents/.sandbox-rollout.XXXXXX")
trap 'rm -rf -- "$verify"; rm -f -- "$new"' EXIT
install --mode="$(stat -c %a "$app/$file")" --owner="$(stat -c %u "$app/$file")" \
  --group="$(stat -c %g "$app/$file")" "$verify/$file" "$new"
check_idle || fail_preflight 'a workflow entered the queue during preparation'
mv -f -- "$new" "$app/$file"
changed=1
(cd "$app" && runuser -u ideaappcode -- "$(command -v node)" --import tsx -e   'import("./src/lib/agents/sandbox.ts").catch(()=>process.exit(1))') || rollback 1
before=$(systemctl show "$worker" -p MainPID --value)
systemctl restart "$worker"
sleep 3
systemctl is-active --quiet "$worker"
after=$(systemctl show "$worker" -p MainPID --value)
[[ "$after" =~ ^[1-9][0-9]*$ && "$after" != "$before" ]]
cmp -s "$app/$file" "$stage/$file"
trap - ERR INT TERM
echo "Browser report fix active. Backup: $backup"
