#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
envfile=/etc/moradi-ideaapp/oauth.env
web=moradi-ideaapp.service
spec=moradi-ideaapp-spec-worker.service
code=moradi-ideaapp-code-worker.service
[[ $(id -u) == 0 && -f "$envfile" ]] || { echo 'Required configuration missing'; exit 1; }
for svc in "$web" "$spec" "$code"; do systemctl is-active --quiet "$svc" || { echo "Service inactive: $svc"; exit 1; }; done
echo '95e958125662e1319e65819a2684c3574f45a112e7012714e7ceeaa85b38d3e9  /tmp/ideaapp-queue-check.mjs' | sha256sum -c
node /tmp/ideaapp-queue-check.mjs "$(systemctl show "$web" -p MainPID --value --no-pager)" | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{try{if(JSON.parse(t).active.length)process.exit(1)}catch{process.exit(1)}})'
backup=$(mktemp -d /root/ideaapp-before-budget.XXXXXX)
cp -a "$envfile" "$backup/oauth.env"
tmp=$(mktemp /etc/moradi-ideaapp/.budget.XXXXXX)
changed=0
rollback(){
  rc=$?
  trap - ERR INT TERM
  rm -f "$tmp"
  if (( changed )); then
    cp -a "$backup/oauth.env" "$envfile"
    systemctl restart "$web" "$spec" "$code" || true
  fi
  echo "Budget setup failed; previous settings restored. Backup: $backup"
  exit "$rc"
}
trap rollback ERR INT TERM
python3 - "$envfile" "$tmp" <<'PY'
import json, os, pathlib, sys
src, dst = map(pathlib.Path, sys.argv[1:])
lines = src.read_text().splitlines()
indices = [i for i, line in enumerate(lines) if line.startswith('AI_TOMAN_LIMITS_JSON=')]
if len(indices) != 1: raise SystemExit('Budget configuration missing or ambiguous')
i = indices[0]
raw = lines[i].split('=', 1)[1].strip()
if len(raw)>=2 and raw[0]==raw[-1] and raw[0] in "'\"": raw=raw[1:-1]
limits=json.loads(raw)
common, free=limits['common'],limits['free']
if common.get('platform_month') != 2000000: raise SystemExit('Unexpected monthly limit')
if free.get("user_month") != 500000 or free.get("project_month") != 500000: raise SystemExit("Unexpected free monthly limits")
common.update(user_day=500000,project_day=500000,run=400000)
free.update(user_day=500000,project_day=500000,run=400000)
lines[i]="AI_TOMAN_LIMITS_JSON='"+json.dumps(limits,separators=(',',':'))+"'"
dst.write_text('\n'.join(lines)+'\n')
os.chmod(dst,0o600)
PY
mv "$tmp" "$envfile"
changed=1
systemctl restart "$web" "$spec" "$code"
ready=0
for attempt in {1..30}; do
  if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3100/ 2>/dev/null; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Web readiness failed'; false; }
for svc in "$web" "$spec" "$code"; do systemctl is-active --quiet "$svc"; done
trap - ERR INT TERM
echo 'Budget updated; existing workers are active.'
echo 'Platform limits remain 2,000,000 toman / 30 days and 500,000 toman / day.'
echo 'Free user and project: 500,000 toman / day and 500,000 toman / 30 days; run limit 400,000.'
echo "Backup: $backup"
