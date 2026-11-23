#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

app=/opt/moradi-apps/ideaapp
stage=${1:?Usage: activate-verifier-hotfix.sh /tmp/ideaapp-verifier.XXXXXX [--check|--activate]}
mode=${2:---check}
release=https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/7374c98ea9c4ad4ed400ec1a2ce71adff8601ed3/deploy/patches
web=moradi-ideaapp.service
spec=moradi-ideaapp-spec-worker.service
code=moradi-ideaapp-code-worker.service
fail_preflight() {
  printf 'Preflight stopped: %s. Production files and database were not changed.\n' "$*" >&2
  exit 1
}
[[ "$mode" == --check || "$mode" == --activate ]] || fail_preflight "unknown mode $mode"
[[ $(id -u) == 0 ]] || fail_preflight "run as root"
[[ "$stage" =~ ^/tmp/ideaapp-verifier\.[a-zA-Z0-9]+$ ]] || fail_preflight "unexpected stage path $stage"
[[ -d "$stage" ]] || fail_preflight "stage directory is missing: $stage"
[[ $(realpath "$stage") == "$stage" ]] || fail_preflight "stage path resolves elsewhere"
stage_owner_mode=$(stat -c '%u:%a' "$stage") || fail_preflight "cannot inspect stage ownership"
[[ "$stage_owner_mode" == 0:700 ]] || fail_preflight "stage owner/mode is $stage_owner_mode, expected 0:700"
[[ -s "$stage/.next/BUILD_ID" ]] || fail_preflight "staged build has no BUILD_ID"
[[ -s "$app/.next/BUILD_ID" ]] || fail_preflight "active installation has no BUILD_ID to back up at $app/.next/BUILD_ID"
echo 'Preflight: both build artifacts found.'
verify=$(mktemp -d /tmp/ideaapp-verifier-rollout.XXXXXX)
trap 'rm -rf -- "$verify"' EXIT
patch="$verify/verifier.patch"
identity="$verify/identity.mjs"
curl -fsSL https://raw.githubusercontent.com/moradisadegh1991-lab/ai-app-builder/9ccaee20a0d21fc89faeddc26ee2f1478cdb4721/deploy/patches/inspect-developer-identity.mjs -o "$identity"
curl -fsSL "$release/verifier-checkpoint-retry.patch" -o "$patch"
printf '%s  %s\n' 22bb76eee718bed39d1b0c79d9299fe48be3035ab9c37f608b1a1deeae2d7736 "$patch" | sha256sum -c
printf '%s  %s\n' 6eb1f4777d8bee54b11021296e787a44dfbb0796614b302fa48a8b9b3b6e6b9d "$identity" | sha256sum -c
for service in "$web" "$spec" "$code"; do
  systemctl is-active --quiet "$service" || fail_preflight "service is not active: $service"
  [[ $(systemctl show "$service" -p WorkingDirectory --value) == "$app" ]] || fail_preflight "unexpected working directory for $service"
done
if [[ "$mode" == --activate ]]; then
  exec 9>/run/lock/ideaapp-recovery-deploy.lock
  flock -n 9 || fail_preflight "another rollout holds the deployment lock"
fi

files=()
while IFS=$'\t' read -r added removed path; do
  [[ "$path" =~ ^src/ && "$path" != *..* ]] || fail_preflight "unexpected patch path"
  files+=("$path")
done < <(git apply --numstat "$patch")
(("${#files[@]}" > 0)) || fail_preflight "no patch files found"
existing=()
created=()
for file in "${files[@]}"; do
  [[ -f "$stage/$file" && ! -L "$stage/$file" ]] || fail_preflight "staged file missing or linked: $file"
  [[ ! "$stage/$file" -nt "$stage/.next/BUILD_ID" ]] || fail_preflight "staged file is newer than build: $file"
  if [[ -f "$app/$file" ]]; then
    existing+=("$file")
    mkdir -p "$verify/$(dirname "$file")"
    cp -a "$app/$file" "$verify/$file"
  else
    created+=("$file")
  fi
done
git -C "$app" apply --check "$patch"
git -C "$verify" apply "$patch"
for file in "${files[@]}"; do cmp "$verify/$file" "$stage/$file"; done
check_idle() {
  local pid
  pid=$(systemctl show "$web" -p MainPID --value)
  node "$identity" "$pid" | node --input-type=module -e '
    let data = "";
    for await (const part of process.stdin) data += part;
    const result = JSON.parse(data);
    console.log(JSON.stringify({ active_workflows: result.active_workflows }));
    if (result.active_workflows !== 0) process.exit(1);
  '
}
check_idle || fail_preflight "wait for queued and running workflows to finish or review the queue check"
if [[ "$mode" == --check ]]; then
  echo 'Preflight passed. Source, services and database were not changed.'
  exit 0
fi

backup=$(mktemp -d /root/ideaapp-before-verifier.XXXXXX)
tar -C "$app" -cf "$backup/source.tar" "${existing[@]}"
newbuild="$app/.next-recovery-new-$$"
oldbuild="$app/.next-recovery-old-$$"
touched=0
swapped=0
services_stopped=0
created_dirs=()

rollback() {
  local rc=$1 restore_error=0
  trap - ERR INT TERM
  if (( services_stopped )); then
    systemctl stop "$code" "$spec" "$web" || restore_error=1
    if (( touched )); then
      for file in "${created[@]}"; do rm -f -- "$app/$file" || restore_error=1; done
      tar -C "$app" -xf "$backup/source.tar" || restore_error=1
      for directory in "${created_dirs[@]}"; do rmdir --ignore-fail-on-non-empty "$directory" || restore_error=1; done
    fi
    if (( swapped )); then
      if [[ -e "$app/.next" ]]; then mv "$app/.next" "$backup/failed-next" || restore_error=1; fi
      mv "$oldbuild" "$app/.next" || restore_error=1
    fi
    systemctl start "$web" "$spec" "$code" || restore_error=1
  fi
  rm -rf -- "$newbuild" || restore_error=1
  if (( restore_error )); then
    echo "Rollback needs attention. Backup: $backup"
  else
    echo "Previous service restored. Backup: $backup"
  fi
  exit "$rc"
}
trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM
cp -a --reflink=auto "$stage/.next" "$newbuild"
chown -R moradiidea:moradiidea "$newbuild"
check_idle
services_stopped=1
systemctl stop "$code" "$spec" "$web"
touched=1
for file in "${files[@]}"; do
  input="$stage/$file"
  directory="$app/$(dirname "$file")"
  if [[ ! -d "$directory" ]]; then
    parent="$directory"
    while [[ ! -d "$parent" ]]; do
      created_dirs+=("$parent")
      parent=$(dirname "$parent")
    done
    install -d -m 0750 -o moradiidea -g moradiidea "$directory"
  fi
  install -m 0640 -o moradiidea -g moradiidea "$input" "$app/$file"
done
mv "$app/.next" "$oldbuild"
swapped=1
mv "$newbuild" "$app/.next"
cd "$app"
for user in moradiidea ideaappcode; do
  runuser -u "$user" -- "$(command -v node)" --import tsx -e 'import("./src/lib/workflows/worker.ts").catch(()=>process.exit(1))'
done
systemctl start "$web"
for try in {1..30}; do
  if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3100/api/health; then break; fi
  sleep 1
done
curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:3100/api/health
systemctl start "$spec" "$code"
sleep 3
for service in "$web" "$spec" "$code"; do systemctl is-active --quiet "$service"; done
trap - ERR INT TERM
echo "Verifier hotfix active. Backup: $backup"
echo "Previous build: $oldbuild"
