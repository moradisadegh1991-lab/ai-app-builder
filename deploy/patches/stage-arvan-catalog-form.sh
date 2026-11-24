#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
release=https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/c27560594af2c20ab433cedabd1cf89f6f0ab423/deploy/patches
[[ $(id -u) == 0 && -f "$app/package.json" && -d "$app/node_modules" ]] || { echo 'Run from the VPS root console.' >&2; exit 1; }
tools=$(mktemp -d /tmp/ideaapp-catalog-ui-tools.XXXXXX)
trap 'rm -rf -- "$tools"' EXIT
patch="$tools/catalog-form.patch"
curl -fsSL "$release/arvan-catalog-form.patch" -o "$patch"
printf '%s  %s\n' 3476921afb6a8c78ecb1a1a32a9a226dd7920ca898ea4846c5e9d2aefafd5938 "$patch" | sha256sum -c
git -C "$app" apply --check "$patch"
stage=$(mktemp -d /tmp/ideaapp-catalog-ui.XXXXXX)
tar -C "$app" --exclude='./node_modules' --exclude='./.next' --exclude='./.env*' \
  --exclude='./.git' --exclude='./out' --exclude='./tsconfig.tsbuildinfo' -cf - . |
  tar --no-same-owner --no-same-permissions --no-overwrite-dir -xf - -C "$stage"
[[ $(stat -c '%u:%a' "$stage") == 0:700 ]] || { echo 'Stage permissions are incorrect.' >&2; exit 1; }
cd "$stage"
git apply "$patch"
cp "$patch" "$stage/arvan-catalog-form-applied.patch"
cp -a --reflink=auto "$app/node_modules" "$stage/node_modules"
env -i PATH="$PATH" npm run typecheck
env -i PATH="$PATH" ./node_modules/.bin/vitest run --maxWorkers=2 tests/friendly-error.test.ts tests/cost-estimate.test.ts
if ! env -i PATH="$PATH" NEXT_TELEMETRY_DISABLED=1 nice -n 15 npm run build > "$stage/build.log" 2>&1; then
  tail -35 "$stage/build.log"
  exit 1
fi
test -s "$stage/.next/BUILD_ID"
printf 'Arvan catalog UI staging ready: %s\n' "$stage"
