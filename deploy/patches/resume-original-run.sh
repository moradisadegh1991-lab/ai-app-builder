#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
base=https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/f9c4fbd655705f5233c2ddd113e0759ccbecc57d/deploy/patches
work=$(mktemp -d /tmp/ideaapp-resume-tools.XXXXXX)
trap 'rm -rf -- "$work"' EXIT
curl -fsSL "$base/deploy-resume-view.sh" -o "$work/deploy.sh"
curl -fsSL "$base/align-resume-budget.sh" -o "$work/budget.sh"
curl -fsSL "$base/resume-code-checkpoints.mjs" -o "$work/resume.mjs"
printf '%s  %s\n' b64fce3df8ead1316924ffb9eb075339981c87272755f7d37d73c9c8d157112c "$work/deploy.sh" | sha256sum -c
printf '%s  %s\n' f2854b629bc910bec52d75527ce3376a7ffda764a741fba58e8c3c8eec32eeb7 "$work/budget.sh" | sha256sum -c
printf '%s  %s\n' c45c4d109022caf32af81eeb22a87cf7e5302a2b28024b353a2285784bb46e41 "$work/resume.mjs" | sha256sum -c
backup=/root/ideaapp-kimi-ledger-before-78e6992d-d307-4e33-947c-2e36ba5722b9.json
pid=$(systemctl show moradi-ideaapp-code-worker.service -p MainPID --value --no-pager)
echo 'Checking original workflow without changing it...'
node "$work/resume.mjs" "$pid" "$backup" --check
echo 'Installing verified workflow view...'
bash "$work/deploy.sh"
echo 'Aligning limits within the existing monthly ceilings...'
bash "$work/budget.sh"
pid=$(systemctl show moradi-ideaapp-code-worker.service -p MainPID --value --no-pager)
echo 'Resuming the original queued workflow...'
node "$work/resume.mjs" "$pid" "$backup"
