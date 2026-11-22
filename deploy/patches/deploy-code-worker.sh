#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
stage=/tmp/ideaapp-arvan.IRC8My
patch=/tmp/ideaapp-code-worker.patch
worker_src=/tmp/ideaapp-code-worker.ts
unit=/etc/systemd/system/moradi-ideaapp-code-worker.service
worker="$app/scripts/ideaapp-code-worker.ts"
web=moradi-ideaapp.service
spec=moradi-ideaapp-spec-worker.service
code=moradi-ideaapp-code-worker.service
[[ $(id -u) == 0 && -s "$stage/.next/BUILD_ID" && -d "$app/.next" ]] || { echo 'Missing build or existing web release'; exit 1; }
[[ $(id -u ideaappcode) == 990 && $(id -gn ideaappcode) == moradiidea ]] || { echo 'Unexpected worker account'; exit 1; }
[[ $(systemctl show "$web" -p WorkingDirectory --value --no-pager) == "$app" ]] || { echo 'Unexpected web directory'; exit 1; }
[[ ! -e "$unit" && ! -e "$worker" ]] || { echo 'Code worker already installed'; exit 1; }
getent group docker >/dev/null
for image in idea2app-build:1 idea2app-sandbox:1 postgres:17-alpine; do docker image inspect "$image" >/dev/null; done
echo '74e916be3f6f2fd21b708c6af1179075e1a2bd19a9b4dfa193ee3972f95b3051  /tmp/ideaapp-code-worker.patch' | sha256sum -c
echo '5e107a4a471c59c248a096a74f5973cd3525439d006cc7a686b21f7af06545c0  /tmp/ideaapp-code-worker.ts' | sha256sum -c
echo '95e958125662e1319e65819a2684c3574f45a112e7012714e7ceeaa85b38d3e9  /tmp/ideaapp-queue-check.mjs' | sha256sum -c
echo 'd1fe1d39f00abe066c31e8c308c833d9a49c136a147d60b8b576ce79b7d77872  /tmp/ideaapp-preflight.mjs' | sha256sum -c
git -C "$app" apply --check "$patch"
node /tmp/ideaapp-preflight.mjs "$(systemctl show "$web" -p MainPID --value --no-pager)" "$app" | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{try{const r=JSON.parse(t),d=r.database,e=r.environment;if(!(e.arvanSelected&&e.gatewayKeyPresent&&e.budgetConfigPresent&&d.reachable&&d.money_guard&&d.cost_column&&d.reservation_link&&d.money_holds&&d.recentUnpricedRecords===0&&d.recentUnpricedHolds===0))process.exit(1)}catch{process.exit(1)}})'
node /tmp/ideaapp-queue-check.mjs "$(systemctl show "$web" -p MainPID --value --no-pager)" | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{try{const a=JSON.parse(t).active;if(a.length!==1||a[0].kind!=="code"||a[0].status!=="queued"||a[0].count!==1)process.exit(1)}catch{process.exit(1)}})'
node_bin=$(command -v node)
backup=$(mktemp -d /root/ideaapp-before-code-worker.XXXXXX)
newbuild="$app/.next-code-new-$$"
tar -C "$app" -cf "$backup/source.tar" src/lib/agents/orchestrator.ts src/lib/agents/sandbox.ts src/lib/ai/index.ts src/lib/workflows/budgets.ts src/lib/ai/providers.ts src/lib/ai/types.ts src/lib/ai/arvan-reference.ts src/lib/ai/arvan-price-snapshot.json src/components/api.ts
cp -a "$stage/.next" "$newbuild"
chown -R moradiidea:moradiidea "$newbuild"
stopped=0
old_moved=0
source_changed=0
worker_created=0
unit_created=0
rollback() {
  rc=$?
  trap - ERR INT TERM
  systemctl disable --now "$code" >/dev/null 2>&1 || true
  if (( unit_created )); then rm -f "$unit"; systemctl daemon-reload || true; fi
  if (( worker_created )); then rm -f "$worker"; fi
  if (( stopped )); then
    systemctl stop "$web" "$spec" >/dev/null 2>&1 || true
    if (( old_moved )); then rm -rf -- "$app/.next"; mv "$backup/next" "$app/.next"; fi
    if (( source_changed )); then tar -C "$app" -xf "$backup/source.tar"; fi
    systemctl start "$web" || true
    systemctl start "$spec" || true
  fi
  rm -rf -- "$newbuild"
  echo "Deployment failed; previous web release restored. Backup: $backup"
  exit "$rc"
}
trap rollback ERR INT TERM
stopped=1
systemctl stop "$spec" "$web"
mv "$app/.next" "$backup/next"
old_moved=1
git -C "$app" apply "$patch"
source_changed=1
for file in src/lib/agents/orchestrator.ts src/lib/agents/sandbox.ts src/lib/ai/index.ts src/lib/workflows/budgets.ts; do
  cmp -s "$stage/$file" "$app/$file" || { echo 'Staged source differs from applied patch'; false; }
  chown moradiidea:moradiidea "$app/$file"
done
chmod g+r "$app/src/lib/agents/orchestrator.ts" "$app/src/lib/agents/sandbox.ts" "$app/src/lib/ai/index.ts" "$app/src/lib/workflows/budgets.ts" "$app/src/lib/ai/providers.ts" "$app/src/lib/ai/types.ts" "$app/src/lib/ai/arvan-reference.ts" "$app/src/lib/ai/arvan-price-snapshot.json" "$app/src/components/api.ts"
(cd "$app" && runuser -u ideaappcode -- "$node_bin" --import tsx -e 'import("./src/lib/workflows/worker.ts").then(()=>console.log("Worker imports readable")).catch(e=>{console.error("Worker import failed:", e.code || e.name);process.exit(1)})')
install -o moradiidea -g moradiidea -m 644 "$worker_src" "$worker"
worker_created=1
cat > "$unit" <<UNIT
[Unit]
Description=IdeaApp code-generation queue worker
After=network-online.target postgresql.service
Wants=network-online.target
[Service]
Type=simple
User=ideaappcode
Group=moradiidea
SupplementaryGroups=docker
WorkingDirectory=$app
Environment=NODE_ENV=production
Environment=AGENT_USE_LIARA_NPM_MIRROR=1
EnvironmentFile=/etc/moradi-ideaapp/oauth.env
LoadCredential=app.env:$app/.env.local
ExecStart=$node_bin --env-file=\${CREDENTIALS_DIRECTORY}/app.env --import tsx $worker
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/tmp
ProtectHome=true
PrivateTmp=false
MemoryMax=1200M
TasksMax=128
[Install]
WantedBy=multi-user.target
UNIT
unit_created=1
systemctl daemon-reload
mv "$newbuild" "$app/.next"
systemctl start "$web"
ready=0
for attempt in {1..30}; do
  if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3100/ 2>/dev/null; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Web readiness failed'; false; }
systemctl start "$spec"
systemctl enable --now "$code"
sleep 3
systemctl is-active --quiet "$web"
systemctl is-active --quiet "$spec"
systemctl is-active --quiet "$code"
trap - ERR INT TERM
echo 'Code worker enabled. The queued job may consume AI credits.'
echo "Rollback backup: $backup"
echo 'Review is text-only; screenshots are not sent to the AI reviewer.'
