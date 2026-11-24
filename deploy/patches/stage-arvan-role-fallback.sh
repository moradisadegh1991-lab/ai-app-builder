#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
release=https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/a4b40516d67878418a824299f71c6a6188395cca/deploy/patches

[[ $(id -u) == 0 && -f "$app/package.json" && -d "$app/node_modules" ]] || { echo 'Run from the VPS root console.' >&2; exit 1; }
run_id=${1:?Supply the workflow tracking ID}
mode=${2:---inspect}
[[ "$mode" == --inspect || "$mode" == --stage ]] || { echo 'Expected --inspect or --stage.' >&2; exit 2; }
tools=$(mktemp -d /tmp/ideaapp-arvan-tools.XXXXXX)
trap 'rm -rf -- "$tools"' EXIT

curl -fsSL "$release/inspect-model-failure.mjs" -o "$tools/inspect.mjs"
printf '%s  %s\n' 780183b39d452625a6fc38ab1ec2e3f4275e18fdaa5d511f6494baf802ab9b0d "$tools/inspect.mjs" | sha256sum -c
node "$tools/inspect.mjs" "$(systemctl show moradi-ideaapp.service -p MainPID --value)" "$run_id"
[[ "$mode" == --stage ]] || exit 0

patch="$tools/arvan-fallback.patch"
curl -fsSL "$release/arvan-role-model-fallback.patch" -o "$patch"
printf '%s  %s\n' 3effd51e256a3c866bb722af0429f6fa33eb2083518b5ea48f15511bda21b218 "$patch" | sha256sum -c
git -C "$app" apply --check "$patch"
stage=$(mktemp -d /tmp/ideaapp-models.XXXXXX)
tar -C "$app" --exclude='./node_modules' --exclude='./.next' --exclude='./.env*' \
  --exclude='./.git' --exclude='./out' --exclude='./tsconfig.tsbuildinfo' -cf - . |
  tar --no-same-owner --no-same-permissions --no-overwrite-dir -xf - -C "$stage"
[[ $(stat -c '%u:%a' "$stage") == 0:700 ]] || { echo 'Stage permissions are incorrect.' >&2; exit 1; }
cd "$stage"
git apply "$patch"
cp -a --reflink=auto "$app/node_modules" "$stage/node_modules"
env -i PATH="$PATH" npm run typecheck
env -i PATH="$PATH" ./node_modules/.bin/vitest run --maxWorkers=2 tests/ai-accounting.test.ts tests/friendly-error.test.ts
if ! env -i PATH="$PATH" NEXT_TELEMETRY_DISABLED=1 nice -n 15 npm run build > "$stage/build.log" 2>&1; then
  tail -35 "$stage/build.log"
  exit 1
fi
test -s "$stage/.next/BUILD_ID"
printf 'Arvan routing staging ready: %s\n' "$stage"
