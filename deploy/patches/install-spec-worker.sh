#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
envfile=/etc/moradi-ideaapp/oauth.env
unit=/etc/systemd/system/moradi-ideaapp-spec-worker.service
worker="$app/scripts/ideaapp-spec-worker.ts"
source_worker=/tmp/ideaapp-spec-worker.ts
[[ $(id -u) == 0 && -f "$envfile" && -d "$app/node_modules/tsx" && -r "$app/.env.local" ]] || { echo 'Required environment or tsx dependency missing'; exit 1; }
[[ ! -e "$unit" && ! -e "$worker" ]] || { echo 'Worker or service already exists; no changes made'; exit 1; }
[[ $(systemctl show moradi-ideaapp.service -p User --value --no-pager) == moradiidea ]] || { echo 'Unexpected service user'; exit 1; }
runuser -u moradiidea -- test -r "$app/.env.local" || { echo 'Service user cannot read application environment'; exit 1; }
echo 'ce933d1cbb5a7b6ca10faf72385b01b6dd56d2faf1db449d25421f2bc7ae4e83  /tmp/ideaapp-spec-worker.ts' | sha256sum -c
node_bin=$(command -v node)
[[ -x "$node_bin" ]] || { echo 'Node executable missing'; exit 1; }
backup=$(mktemp -d /root/ideaapp-before-spec-worker.XXXXXX)
cp -a "$envfile" "$backup/oauth.env"
created_worker=0
created_unit=0
config_changed=0
rollback() {
  rc=$?
  trap - ERR INT TERM
  systemctl disable --now moradi-ideaapp-spec-worker.service >/dev/null 2>&1 || true
  if (( created_unit )); then rm -f "$unit"; systemctl daemon-reload || true; fi
  if (( created_worker )); then rm -f "$worker"; fi
  if (( config_changed )); then cp -a "$backup/oauth.env" "$envfile"; fi
  echo "Worker setup failed; original configuration restored. Backup: $backup"
  exit "$rc"
}
trap rollback ERR INT TERM
python3 - "$envfile" "$backup/oauth.new" <<'PY'
import json, os, pathlib, sys
src, dst = map(pathlib.Path, sys.argv[1:])
lines = src.read_text().splitlines()
indices = [i for i, line in enumerate(lines) if line.startswith('AI_TOMAN_LIMITS_JSON=')]
if len(indices) != 1: raise SystemExit('Budget configuration missing or ambiguous')
i = indices[0]
raw = lines[i].split('=', 1)[1].strip()
if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "'\"": raw = raw[1:-1]
limits = json.loads(raw)
if limits.get('common', {}).get('platform_month') != 2000000: raise SystemExit('Unexpected monthly platform budget')
common, free = limits['common'], limits['free']
common.update(user_day=200000, project_day=200000, run=150000)
free.update(user_day=150000, user_month=300000, project_day=150000, project_month=300000, run=150000)
lines[i] = "AI_TOMAN_LIMITS_JSON='" + json.dumps(limits,separators=(',',':')) + "'"
dst.write_text('\n'.join(lines)+'\n')
os.chmod(dst, 0o600)
PY
install -o moradiidea -g moradiidea -m 644 "$source_worker" "$worker"
created_worker=1
cat > "$unit" <<UNIT
[Unit]
Description=IdeaApp requirements queue worker
After=network-online.target postgresql.service
Wants=network-online.target
[Service]
Type=simple
User=moradiidea
Group=moradiidea
WorkingDirectory=$app
Environment=NODE_ENV=production
EnvironmentFile=$envfile
ExecStart=$node_bin --env-file-if-exists=$app/.env.local --import tsx $worker
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
InaccessiblePaths=-/run/docker.sock
MemoryMax=768M
TasksMax=128
[Install]
WantedBy=multi-user.target
UNIT
created_unit=1
install -m 600 "$backup/oauth.new" "$envfile"
rm -f "$backup/oauth.new"
config_changed=1
systemctl daemon-reload
systemctl enable --now moradi-ideaapp-spec-worker.service
sleep 3
systemctl is-active --quiet moradi-ideaapp-spec-worker.service
trap - ERR INT TERM
echo 'Requirements worker started. It may consume AI credit for queued spec requests.'
echo 'Only requirements are processed; code generation remains queued pending isolated verification.'
echo "Configuration backup: $backup"
