#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
stage=/tmp/ideaapp-arvan.IRC8My
patch=/tmp/ideaapp-developer-no-cap.patch
envfile=/etc/moradi-ideaapp/oauth.env
web=moradi-ideaapp.service
spec=moradi-ideaapp-spec-worker.service
code=moradi-ideaapp-code-worker.service
files=(src/lib/workflows/budgets.ts)
[[ $(id -u) == 0 && -f "$envfile" && -d "$app/.next" && -s "$stage/.next/BUILD_ID" ]] || { echo 'Missing current or staged release'; exit 1; }
for svc in "$web" "$spec" "$code"; do systemctl is-active --quiet "$svc" || { echo "Service inactive: $svc"; exit 1; }; done
for file in "${files[@]}"; do [[ "$stage/.next/BUILD_ID" -nt "$stage/$file" ]] || { echo 'Staged build is older than source'; exit 1; }; done
echo '8bba7ebf9503914394f26bb0d07e561d5741ef53ab16bbea2460b01b265262d3  /tmp/ideaapp-developer-no-cap.patch' | sha256sum -c
echo '6eb1f4777d8bee54b11021296e787a44dfbb0796614b302fa48a8b9b3b6e6b9d  /tmp/ideaapp-developer-check.mjs' | sha256sum -c
echo 'b142f33b6a6b4b23573c8e2ca490ad607725863b63bcd7e4ba391b27d0fa9799  /tmp/ideaapp-verify-developer-no-cap.mjs' | sha256sum -c
git -C "$app" apply --check "$patch"
# Verify the patched source matches the tested build before touching the service.
verifytree=$(mktemp -d /tmp/ideaapp-developer-source.XXXXXX)
trap 'rm -rf -- "$verifytree"' EXIT
for file in "${files[@]}"; do mkdir -p "$verifytree/$(dirname "$file")"; cp -a "$app/$file" "$verifytree/$file"; done
git -C "$verifytree" apply --check "$patch"
git -C "$verifytree" apply "$patch"
for file in "${files[@]}"; do cmp -s "$stage/$file" "$verifytree/$file" || { echo 'Staged source differs from current installation'; exit 1; }; done
rm -rf -- "$verifytree"
pid=$(systemctl show "$web" -p MainPID --value --no-pager)
node /tmp/ideaapp-developer-check.mjs "$pid" | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{try{let r=JSON.parse(t);if(r.github_id_matches!==1||r.login_matches!==1||r.active_workflows!==0)process.exit(1)}catch{process.exit(1)}})'
backup=$(mktemp -d /root/ideaapp-before-developer.XXXXXX)
newbuild="$app/.next-developer-new-$$"
tar -C "$app" -cf "$backup/source.tar" "${files[@]}"
cp -a "$stage/.next" "$newbuild"
chown -R moradiidea:moradiidea "$newbuild"
stopped=0
old_moved=0
source_changed=0
rollback(){
 rc=$?
 trap - ERR INT TERM
 if ! mkdir "$backup/rollback.lock" 2>/dev/null; then exit "$rc"; fi
 restore_failed=0
 if (( stopped )); then
  systemctl stop "$code" "$spec" "$web" >/dev/null 2>&1 || true
  if (( old_moved )); then
   if [[ -e "$backup/next" ]]; then rm -rf -- "$app/.next" && mv "$backup/next" "$app/.next" || restore_failed=1; else restore_failed=1; fi
  fi
  if (( source_changed )); then tar -C "$app" -xf "$backup/source.tar" || restore_failed=1; fi
  systemctl start "$web" "$spec" "$code" || restore_failed=1
 fi
 rm -rf -- "$newbuild" || restore_failed=1
 if (( restore_failed )); then echo "Developer rollout failed; rollback needs attention. Backup: $backup"; else echo "Developer rollout failed; previous version restored. Backup: $backup"; fi
 exit "$rc"
}
trap rollback ERR INT TERM
stopped=1
systemctl stop "$code" "$spec" "$web"
mv "$app/.next" "$backup/next"
old_moved=1
git -C "$app" apply "$patch"
source_changed=1
for file in "${files[@]}"; do
 cmp -s "$stage/$file" "$app/$file" || { echo 'Staged source differs'; false; }
 chown moradiidea:moradiidea "$app/$file"
 chmod g+r "$app/$file"
done
pushd "$app" >/dev/null
runuser -u ideaappcode -- "$(command -v node)" --import tsx -e 'import("./src/lib/workflows/worker.ts").then(()=>console.log("Worker imports readable")).catch(e=>{console.error("Worker import failed:",e.code||e.name);process.exit(1)})'
popd >/dev/null
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
pid=$(systemctl show "$web" -p MainPID --value --no-pager)
pushd "$app" >/dev/null
node --import tsx /tmp/ideaapp-verify-developer-no-cap.mjs "$pid"
node --import tsx -e 'import("./src/lib/workflows/budgets.ts").then(m=>{const c={platform_day:10,platform_month:20,user_day:10,user_month:20,project_day:10,project_month:20,run:10};const s=JSON.stringify({common:c,free:c});const d=m.moneyLimits(s,false,true),n=m.moneyLimits(s,false,false);if(!d||!n||d.platform_day!==999999999999||d.platform_month!==999999999999||n.platform_day!==10||n.platform_month!==20)process.exit(1);console.log("Developer exemption and regular limits verified")}).catch(()=>process.exit(1))'
popd >/dev/null
trap - ERR INT TERM
echo 'Developer money-cap exemption active; platform consumption remains recorded.'
echo "Rollback backup: $backup"
