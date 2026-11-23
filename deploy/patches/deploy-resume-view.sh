#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
stage=/tmp/ideaapp-arvan.IRC8My
patch=/tmp/ideaapp-resume-view.patch
web=moradi-ideaapp.service
spec=moradi-ideaapp-spec-worker.service
code=moradi-ideaapp-code-worker.service
[[ $(id -u) == 0 && -d "$app/.next" && -s "$stage/.next/BUILD_ID" ]] || { echo 'Missing current or staged build'; exit 1; }
for svc in "$web" "$spec" "$code"; do systemctl is-active --quiet "$svc" || { echo "Service inactive: $svc"; exit 1; }; done
echo '97af2e17eee0071bde1f6d3835a3cbaa732bc5c2ae8e0c7a00aaa6ea8e5e855c  /tmp/ideaapp-resume-view.patch' | sha256sum -c
echo '95e958125662e1319e65819a2684c3574f45a112e7012714e7ceeaa85b38d3e9  /tmp/ideaapp-queue-check.mjs' | sha256sum -c
git -C "$app" apply --check "$patch"
node /tmp/ideaapp-queue-check.mjs "$(systemctl show "$web" -p MainPID --value --no-pager)" | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{try{if(JSON.parse(t).active.length)process.exit(1)}catch{process.exit(1)}})'
backup=$(mktemp -d /root/ideaapp-before-resume-view.XXXXXX)
newbuild="$app/.next-resume-new-$$"
tar -C "$app" -cf "$backup/source.tar" src/lib/workflows/queue.ts
cp -a "$stage/.next" "$newbuild"
chown -R moradiidea:moradiidea "$newbuild"
stopped=0
old_moved=0
source_changed=0
rollback(){
 rc=$?
 trap - ERR INT TERM
 if (( stopped )); then
   systemctl stop "$code" "$spec" "$web" >/dev/null 2>&1 || true
   if (( old_moved )); then rm -rf -- "$app/.next"; mv "$backup/next" "$app/.next"; fi
   if (( source_changed )); then tar -C "$app" -xf "$backup/source.tar"; fi
   systemctl start "$web" "$spec" "$code" || true
 fi
 rm -rf -- "$newbuild"
 echo "Deployment failed; previous version restored. Backup: $backup"
 exit "$rc"
}
trap rollback ERR INT TERM
stopped=1
systemctl stop "$code" "$spec" "$web"
mv "$app/.next" "$backup/next"
old_moved=1
git -C "$app" apply "$patch"
source_changed=1
cmp -s "$stage/src/lib/workflows/queue.ts" "$app/src/lib/workflows/queue.ts"
chown moradiidea:moradiidea "$app/src/lib/workflows/queue.ts"
chmod g+r "$app/src/lib/workflows/queue.ts"
node_bin=$(command -v node)
(cd "$app" && runuser -u ideaappcode -- "$node_bin" --import tsx -e 'import("./src/lib/workflows/worker.ts").then(()=>console.log("Worker imports readable")).catch(e=>{console.error("Worker import failed:",e.code||e.name);process.exit(1)})')
mv "$newbuild" "$app/.next"
systemctl start "$web"
ready=0
for attempt in {1..30}; do
 if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3100/ 2>/dev/null; then ready=1; break; fi
 sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Web readiness failed'; false; }
systemctl start "$spec" "$code"
sleep 3
for svc in "$web" "$spec" "$code"; do systemctl is-active --quiet "$svc"; done
trap - ERR INT TERM
echo 'Resume view fix deployed; no database records changed.'
echo "Rollback backup: $backup"
