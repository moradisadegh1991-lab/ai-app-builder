#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

app=/opt/moradi-apps/ideaapp
stage=${1:?Usage: activate-arvan-catalog-form.sh /tmp/ideaapp-catalog-ui.XXXXXX [--check|--activate]}
mode=${2:---check}
web=moradi-ideaapp.service
fail_preflight() {
  printf 'Preflight stopped: %s. Production files and database were not changed.\n' "$*" >&2
  exit 1
}
[[ "$mode" == --check || "$mode" == --activate ]] || fail_preflight "unknown mode $mode"
[[ $(id -u) == 0 ]] || fail_preflight "run as root"
[[ "$stage" =~ ^/tmp/ideaapp-catalog-ui\.[a-zA-Z0-9]+$ ]] || fail_preflight "unexpected stage path $stage"
[[ -d "$stage" ]] || fail_preflight "stage directory is missing: $stage"
[[ $(realpath "$stage") == "$stage" ]] || fail_preflight "stage path resolves elsewhere"
stage_owner_mode=$(stat -c '%u:%a' "$stage") || fail_preflight "cannot inspect stage ownership"
[[ "$stage_owner_mode" == 0:700 ]] || fail_preflight "stage owner/mode is $stage_owner_mode, expected 0:700"
[[ -s "$stage/.next/BUILD_ID" ]] || fail_preflight "staged build has no BUILD_ID"
[[ -s "$app/.next/BUILD_ID" ]] || fail_preflight "active installation has no BUILD_ID to back up at $app/.next/BUILD_ID"
echo 'Preflight: both build artifacts found.'
verify=$(mktemp -d /tmp/ideaapp-catalog-ui-rollout.XXXXXX)
trap 'rm -rf -- "$verify"' EXIT
patch="$stage/arvan-catalog-form-applied.patch"
[[ -f "$patch" && ! -L "$patch" ]] || fail_preflight 'staged patch is missing'
printf '%s  %s\n' 3476921afb6a8c78ecb1a1a32a9a226dd7920ca898ea4846c5e9d2aefafd5938 "$patch" | sha256sum -c
systemctl is-active --quiet "$web" || fail_preflight "web service is not active"
[[ $(systemctl show "$web" -p WorkingDirectory --value) == "$app" ]] || fail_preflight "unexpected web working directory"
if [[ "$mode" == --activate ]]; then
  exec 9>/run/lock/ideaapp-recovery-deploy.lock
  flock -n 9 || fail_preflight "another rollout holds the deployment lock"
fi

files=()
while IFS=$'\t' read -r added removed path; do
  case "$path" in
    src/components/ArvanCatalogPanel.tsx|src/components/arvan-catalog-form.ts) ;;
    *) fail_preflight "unexpected patch path" ;;
  esac
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
if [[ "$mode" == --check ]]; then
  echo 'Preflight passed. Source, services and database were not changed.'
  exit 0
fi

backup=$(mktemp -d /root/ideaapp-before-catalog-ui.XXXXXX)
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
  mkdir "$backup/rollback.lock" 2>/dev/null || exit "$rc"
  if (( services_stopped )); then
    systemctl stop "$web" || restore_error=1
    if (( touched )); then
      for file in "${created[@]}"; do rm -f -- "$app/$file" || restore_error=1; done
      tar -C "$app" -xf "$backup/source.tar" || restore_error=1
      for directory in "${created_dirs[@]}"; do rmdir --ignore-fail-on-non-empty "$directory" || restore_error=1; done
    fi
    if (( swapped )); then
      if [[ -e "$app/.next" ]]; then mv "$app/.next" "$backup/failed-next" || restore_error=1; fi
      mv "$oldbuild" "$app/.next" || restore_error=1
    fi
    systemctl start "$web" || restore_error=1
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
services_stopped=1
systemctl stop "$web"
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
systemctl start "$web"
for try in {1..30}; do
  if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3100/api/health 2>/dev/null; then break; fi
  sleep 1
done
curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:3100/api/health
systemctl is-active --quiet "$web"
trap - ERR INT TERM
echo "Arvan catalog UI active. Backup: $backup"
echo "Previous build: $oldbuild"
