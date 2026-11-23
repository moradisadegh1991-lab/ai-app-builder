#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

app=/opt/moradi-apps/ideaapp
patch=/tmp/ideaapp-vps-recovery-quota.patch
installer=/tmp/ideaapp-activate-recovery-v2.sh
mode=${1:---stage-only}
if [[ "$mode" != --stage-only && "$mode" != --activate ]]; then
  echo 'Usage: prepare-recovery-release.sh [--stage-only|--activate]' >&2
  exit 2
fi
if [[ $(id -u) != 0 ]]; then
  echo 'Run from the root console.' >&2
  exit 1
fi
if [[ "$mode" == --activate ]]; then
  printf '%s  %s\n' a349373917650fe540fc42e3e82df75f5cda49860a57de97e13427850470df9a "$installer" | sha256sum -c
fi
expected=7484c780135c78d8b5793e14cf403f3a4c55870647a7f340376a96cd7d4ec28f
[[ -f "$app/package.json" && -d "$app/node_modules" ]] || { echo 'Installed IdeaApp release not found'; exit 1; }
read -r actual _ < <(sha256sum -- "$patch")
[[ "$actual" == "$expected" ]] || { echo 'Recovery patch checksum mismatch'; exit 1; }
patch=$(realpath -- "$patch")

stage=$(mktemp -d /tmp/ideaapp-recovery.XXXXXX)
echo "Staging in $stage"
check_private_stage() {
  local owner_mode
  owner_mode=$(stat -c '%u:%a' -- "$stage")
  if [[ "$owner_mode" != 0:700 ]]; then
    printf 'Private stage check failed: found %s, expected 0:700.\n' "$owner_mode" >&2
    exit 1
  fi
}
# Copy source and build inputs only. The running service and its environment are not used.
tar -C "$app" --exclude='./node_modules' --exclude='./.next' --exclude='./.env*' \
  --exclude='./.git' --exclude='./out' --exclude='./tsconfig.tsbuildinfo' -cf - . |
  tar --no-same-owner --no-same-permissions --no-overwrite-dir -xf - -C "$stage"
check_private_stage
cd "$stage"
git apply --check "$patch"
git apply "$patch"
node --input-type=module <<'JS'
import fs from 'node:fs';
const path = 'drizzle/meta/_journal.json';
const journal = JSON.parse(fs.readFileSync(path, 'utf8'));
const tag = '0013_ai_quota_recovery';
const when = 1795000000005;
if (journal.entries.some((entry) => entry.tag === tag || entry.when >= when)) {
  throw new Error('Unexpected migration order; review this release before proceeding');
}
journal.entries.push({ idx: journal.entries.length, version: '7', when, tag, breakpoints: true });
fs.writeFileSync(path, JSON.stringify(journal, null, 2) + '\n');
JS
node scripts/sync-db-setup.mjs
cp -a --reflink=auto "$app/node_modules" "$stage/node_modules"
env -i PATH="$PATH" npm run typecheck
env -i PATH="$PATH" ./node_modules/.bin/vitest run --maxWorkers=2 tests/ai-accounting.test.ts tests/friendly-error.test.ts
if ! env -i PATH="$PATH" NEXT_TELEMETRY_DISABLED=1 nice -n 15 npm run build > "$stage/build.log" 2>&1; then
  tail -35 "$stage/build.log"
  exit 1
fi
test -s "$stage/.next/BUILD_ID"
check_private_stage
echo "Staging ready: $stage"
if [[ "$mode" == --activate ]]; then
  exec bash "$installer" "$stage" --activate
fi
echo 'Production files, services and database were not touched.'
