#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
stage=/tmp/ideaapp-arvan.IRC8My
envfile=/etc/moradi-ideaapp/oauth.env
patch=/tmp/ideaapp-arvan.patch
service=moradi-ideaapp.service
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
[[ -s "$stage/.next/BUILD_ID" && -f "$envfile" && -d "$app/.next" ]] || { echo 'Missing build, environment or current release'; exit 1; }
[[ $(systemctl show "$service" -p User --value --no-pager) == moradiidea ]] || { echo 'Unexpected service user'; exit 1; }
[[ $(systemctl show "$service" -p WorkingDirectory --value --no-pager) == "$app" ]] || { echo 'Unexpected working directory'; exit 1; }
echo '1d2c2bac72fd11bcc6e40196ddb4d38a72b4074fed1b13d6ba61b9ffa658a49e  /tmp/ideaapp-arvan.patch' | sha256sum -c
git -C "$app" apply --check "$patch"
[[ ! -e "$app/src/lib/ai/arvan-reference.ts" && ! -e "$app/src/lib/ai/arvan-price-snapshot.json" ]] || { echo 'Arvan files already exist'; exit 1; }
echo 'd1fe1d39f00abe066c31e8c308c833d9a49c136a147d60b8b576ce79b7d77872  /tmp/ideaapp-preflight.mjs' | sha256sum -c
node /tmp/ideaapp-preflight.mjs "$(systemctl show "$service" -p MainPID --value --no-pager)" "$app" | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{try{const d=JSON.parse(t).database;if(!(d.reachable&&d.money_guard&&d.cost_column&&d.reservation_link&&d.money_holds&&d.recentUnpricedRecords===0&&d.recentUnpricedHolds===0))process.exit(1)}catch{process.exit(1)}})'
read -r -s -p 'Arvan gateway key (sk-gw-...): ' idea_arvan_secret; echo
[[ "$idea_arvan_secret" =~ ^sk-gw-[A-Za-z0-9_-]+$ ]] || { unset idea_arvan_secret; echo 'Invalid gateway key format'; exit 1; }
export IDEA_DEPLOY_ARVAN_KEY="$idea_arvan_secret"
unset idea_arvan_secret
backup=$(mktemp -d /root/ideaapp-before-arvan.XXXXXX)
newbuild="$app/.next-arvan-new-$$"
cp -a "$envfile" "$backup/oauth.env"
tar -C "$app" -cf "$backup/source.tar" src/components/api.ts src/lib/ai/index.ts src/lib/ai/providers.ts src/lib/ai/types.ts
cp -a "$stage/.next" "$newbuild"
chown -R moradiidea:moradiidea "$newbuild"
python3 - "$envfile" "$backup/oauth.new" <<'PY'
import json, os, pathlib, sys
source, target = map(pathlib.Path, sys.argv[1:])
keys = {'AI_GATEWAY_KIND', 'AI_GATEWAY_BASE_URL', 'AI_GATEWAY_API_KEY', 'AI_TOMAN_LIMITS_JSON'}
lines = source.read_text().splitlines()
lines = [line for line in lines if line.lstrip().split('=', 1)[0].strip() not in keys]
common = dict(platform_day=200000, platform_month=2000000, user_day=100000, user_month=500000, project_day=100000, project_month=500000, run=150000)
free = dict(platform_day=200000, platform_month=2000000, user_day=50000, user_month=100000, project_day=50000, project_month=100000, run=50000)
limits = json.dumps(dict(common=common, free=free), separators=(',', ':'))
lines += ['AI_GATEWAY_KIND=arvan', 'AI_GATEWAY_BASE_URL=https://api.arvancloudai.ir/v1', 'AI_GATEWAY_API_KEY='+os.environ['IDEA_DEPLOY_ARVAN_KEY'], "AI_TOMAN_LIMITS_JSON='"+limits+"'"]
target.write_text('\n'.join(lines)+'\n')
os.chmod(target, 0o600)
PY
unset IDEA_DEPLOY_ARVAN_KEY
stopped=0
old_moved=0
source_changed=0
rollback() {
  rc=$?
  trap - ERR INT TERM
  echo 'Deployment failed; restoring the previous service.'
  if (( stopped )); then
    systemctl stop "$service" || true
    if (( old_moved )); then rm -rf -- "$app/.next"; mv "$backup/next" "$app/.next"; fi
    if (( source_changed )); then
      tar -C "$app" -xf "$backup/source.tar"
      rm -f "$app/src/lib/ai/arvan-reference.ts" "$app/src/lib/ai/arvan-price-snapshot.json"
    fi
    cp -a "$backup/oauth.env" "$envfile"
    systemctl restart "$service" || true
  fi
  rm -rf -- "$newbuild"
  echo "Backup: $backup"
  exit "$rc"
}
trap rollback ERR INT TERM
systemctl stop "$service"
stopped=1
mv "$app/.next" "$backup/next"
old_moved=1
git -C "$app" apply "$patch"
source_changed=1
chown moradiidea:moradiidea "$app/src/components/api.ts" "$app/src/lib/ai/index.ts" "$app/src/lib/ai/providers.ts" "$app/src/lib/ai/types.ts" "$app/src/lib/ai/arvan-reference.ts" "$app/src/lib/ai/arvan-price-snapshot.json"
mv "$newbuild" "$app/.next"
install -m 600 "$backup/oauth.new" "$envfile"
rm -f "$backup/oauth.new"
systemctl start "$service"
ready=0
for attempt in {1..30}; do
  if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3100/; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'HTTP readiness failed'; false; }
systemctl is-active --quiet "$service"
trap - ERR INT TERM
echo 'Deployment finished; no paid AI request was sent.'
echo "Rollback backup: $backup"
echo 'Budget: 2,000,000 toman per rolling 30 days; 200,000 per rolling day.'
