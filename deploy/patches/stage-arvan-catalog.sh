#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
release=https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/123ba5d67ff2ce1483ddacb93956bde583d6b47e/deploy/patches
[[ $(id -u) == 0 && -f "$app/package.json" && -d "$app/node_modules" ]] || { echo 'Run from the VPS root console.' >&2; exit 1; }
tools=$(mktemp -d /tmp/ideaapp-catalog-tools.XXXXXX)
trap 'rm -rf -- "$tools"' EXIT
patch="$tools/rollup.patch"
curl -fsSL "$release/arvan-catalog-rollup.patch" -o "$patch"
printf '%s  %s\n' f7233ed16296501b7f13cf3411262bc3f6901c2b999040bf8cdfd38880fe34cc "$patch" | sha256sum -c
if ! git -C "$app" apply --check "$patch" 2>/dev/null; then
  patch="$tools/incremental.patch"
  curl -fsSL "$release/arvan-catalog-incremental.patch" -o "$patch"
  printf '%s  %s\n' b41d649305694670c9669a195b5beebad84416e79afe16a3c19e23a9814799a5 "$patch" | sha256sum -c
  git -C "$app" apply --check "$patch"
fi
stage=$(mktemp -d /tmp/ideaapp-catalog.XXXXXX)
tar -C "$app" --exclude='./node_modules' --exclude='./.next' --exclude='./.env*' \
  --exclude='./.git' --exclude='./out' --exclude='./tsconfig.tsbuildinfo' -cf - . |
  tar --no-same-owner --no-same-permissions --no-overwrite-dir -xf - -C "$stage"
[[ $(stat -c '%u:%a' "$stage") == 0:700 ]] || { echo 'Stage permissions are incorrect.' >&2; exit 1; }
cd "$stage"
git apply "$patch"
cp "$patch" "$stage/arvan-catalog-applied.patch"
node --input-type=module <<'JS'
import fs from "node:fs";
const path = "drizzle/meta/_journal.json";
const journal = JSON.parse(fs.readFileSync(path, "utf8"));
const tag = "0014_arvan_model_catalog", when = 1795000000006;
if (!journal.entries.some((entry) => entry.tag === "0013_ai_quota_recovery") ||
    journal.entries.some((entry) => entry.tag === tag || entry.when >= when)) {
  throw new Error("Unexpected migration order; review this release before proceeding.");
}
journal.entries.push({ idx: journal.entries.length, version: "7", when, tag, breakpoints: true });
fs.writeFileSync(path, JSON.stringify(journal, null, 2) + "\n");
JS
node scripts/sync-db-setup.mjs
cp -a --reflink=auto "$app/node_modules" "$stage/node_modules"
env -i PATH="$PATH" npm run typecheck
env -i PATH="$PATH" ./node_modules/.bin/vitest run --maxWorkers=2 tests/friendly-error.test.ts tests/cost-estimate.test.ts
if ! env -i PATH="$PATH" NEXT_TELEMETRY_DISABLED=1 nice -n 15 npm run build > "$stage/build.log" 2>&1; then
  tail -35 "$stage/build.log"
  exit 1
fi
test -s "$stage/.next/BUILD_ID"
printf 'Arvan catalog staging ready: %s\n' "$stage"
