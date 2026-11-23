#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
base=https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/cba7d2b5b5d8e71f5deddd901f7e99e896e1cf64/deploy/patches
work=$(mktemp -d /tmp/ideaapp-latest-retry.XXXXXX)
trap 'rm -rf -- "$work"' EXIT
curl -fsSL "$base/align-resume-budget.sh" -o "$work/budget.sh"
curl -fsSL "$base/resume-latest-budgeted.mjs" -o "$work/retry.mjs"
printf '%s  %s\n' f2854b629bc910bec52d75527ce3376a7ffda764a741fba58e8c3c8eec32eeb7 "$work/budget.sh" | sha256sum -c
printf '%s  %s\n' c581b29e143b3154da968bb262fb0b5f9ffc1f48b20d4dee35163cfcd1dd658b "$work/retry.mjs" | sha256sum -c
backup=/root/ideaapp-kimi-ledger-before-78e6992d-d307-4e33-947c-2e36ba5722b9.json
pid=$(systemctl show moradi-ideaapp-code-worker.service -p MainPID --value --no-pager)
echo 'Previewing the latest workflow and exact reservations...'
node "$work/retry.mjs" "$pid" "$backup" --check
echo 'Aligning daily and run limits within existing monthly limits...'
bash "$work/budget.sh"
pid=$(systemctl show moradi-ideaapp-code-worker.service -p MainPID --value --no-pager)
echo 'Reconciling the two measured holds and resuming the latest workflow...'
node "$work/retry.mjs" "$pid" "$backup" --apply
