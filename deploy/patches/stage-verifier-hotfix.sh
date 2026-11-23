#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
release=https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/7374c98ea9c4ad4ed400ec1a2ce71adff8601ed3/deploy/patches

[[ $(id -u) == 0 && -f "$app/package.json" && -d "$app/node_modules" ]] || { echo 'Run from the VPS root console.' >&2; exit 1; }
run_id=${1:?Supply the workflow tracking ID}
mode=${2:---inspect}
[[ "$mode" == --inspect || "$mode" == --stage ]] || { echo 'Expected --inspect or --stage.' >&2; exit 2; }
tools=$(mktemp -d /tmp/ideaapp-verifier-tools.XXXXXX)
trap 'rm -rf -- "$tools"' EXIT

curl -fsSL "$release/inspect-verifier-stop.mjs" -o "$tools/inspect.mjs"
printf '%s  %s\n' 5ba054c4ce1cde5cd2ea11ce304e91f2f8976591b77dead74e0f181453aaa61f "$tools/inspect.mjs" | sha256sum -c
node "$tools/inspect.mjs" "$(systemctl show moradi-ideaapp.service -p MainPID --value)" "$run_id"
[[ "$mode" == --stage ]] || exit 0

patch="$tools/verifier.patch"
curl -fsSL "$release/verifier-checkpoint-retry.patch" -o "$patch"
printf '%s  %s\n' 22bb76eee718bed39d1b0c79d9299fe48be3035ab9c37f608b1a1deeae2d7736 "$patch" | sha256sum -c
git -C "$app" apply --check "$patch"
stage=$(mktemp -d /tmp/ideaapp-verifier.XXXXXX)
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
printf 'Verifier hotfix staging ready: %s\n' "$stage"
