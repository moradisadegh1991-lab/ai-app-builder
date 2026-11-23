#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app=/opt/moradi-apps/ideaapp
stage=/tmp/ideaapp-arvan.IRC8My
patch=/tmp/ideaapp-developer.patch
envfile=/etc/moradi-ideaapp/oauth.env
web=moradi-ideaapp.service
spec=moradi-ideaapp-spec-worker.service
code=moradi-ideaapp-code-worker.service
files=(src/lib/billing/subscription.ts src/lib/env.ts src/lib/rate-limit.ts src/lib/workflows/budgets.ts src/lib/workflows/queue.ts src/lib/workflows/worker.ts)
[[ $(id -u) == 0 && -f "$envfile" && -d "$app/.next" && -s "$stage/.next/BUILD_ID" ]] || { echo 'Missing current or staged release'; exit 1; }
for svc in "$web" "$spec" "$code"; do systemctl is-active --quiet "$svc" || { echo "Service inactive: $svc"; exit 1; }; done
for file in "${files[@]}"; do [[ "$stage/.next/BUILD_ID" -nt "$stage/$file" ]] || { echo 'Staged build is older than source'; exit 1; }; done
echo '5ef3647eea5c06112a96efdd21dfe4ec55fca16749602600b414b3098050cf8d  /tmp/ideaapp-developer.patch' | sha256sum -c
echo '6eb1f4777d8bee54b11021296e787a44dfbb0796614b302fa48a8b9b3b6e6b9d  /tmp/ideaapp-developer-check.mjs' | sha256sum -c
echo '154a6b6caebbd2d22649d1b4f5f2cf7d6392eb29b2b7be769bcc06d5d86d9249  /tmp/ideaapp-verify-developer.mjs' | sha256sum -c
git -C "$app" apply --check "$patch"
pid=$(systemctl show "$web" -p MainPID --value --no-pager)
node /tmp/ideaapp-developer-check.mjs "$pid" | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{try{let r=JSON.parse(t);if(r.github_id_matches!==1||r.login_matches!==1||r.active_workflows!==0)process.exit(1)}catch{process.exit(1)}})'
backup=$(mktemp -d /root/ideaapp-before-developer.XXXXXX)
newbuild="$app/.next-developer-new-$$"
cp -a "$envfile" "$backup/oauth.env"
tar -C "$app" -cf "$backup/source.tar" "${files[@]}"
node - "$pid" "$app" "$envfile" "$backup/oauth.new" <<'JS'
const fs=require('node:fs');const {createRequire}=require('node:module');
const [pid,app,source,target]=process.argv.slice(2);delete process.env.DEVELOPER_GITHUB_IDS;
for(const part of fs.readFileSync(`/proc/${pid}/environ`,'utf8').split('\0')){const i=part.indexOf('=');if(i>0&&part.slice(0,i)==='DEVELOPER_GITHUB_IDS')process.env.DEVELOPER_GITHUB_IDS=part.slice(i+1)}
createRequire(`${app}/package.json`)('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
const ids=(process.env.DEVELOPER_GITHUB_IDS??'').split(',').map(x=>x.trim()).filter(Boolean);
if(ids.some(x=>!(/^[1-9][0-9]{0,14}$/).test(x)))throw Error('Invalid existing developer ID configuration');
if(!ids.includes('292149705'))ids.push('292149705');
const lines=fs.readFileSync(source,'utf8').split(/\r?\n/).filter(line=>!/^\s*DEVELOPER_GITHUB_IDS\s*=/.test(line));
lines.push(`DEVELOPER_GITHUB_IDS=${ids.join(',')}`);
fs.writeFileSync(target,lines.join('\n')+'\n',{mode:0o600,flag:'wx'});
JS
cp -a "$stage/.next" "$newbuild"
chown -R moradiidea:moradiidea "$newbuild"
stopped=0
old_moved=0
source_changed=0
env_changed=0
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
  if (( env_changed )); then cp -a "$backup/oauth.env" "$envfile" || restore_failed=1; fi
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
install -m 600 "$backup/oauth.new" "$envfile"
rm -f "$backup/oauth.new"
env_changed=1
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
node --import tsx /tmp/ideaapp-verify-developer.mjs "$pid"
popd >/dev/null
trap - ERR INT TERM
echo 'Developer access is active. Existing platform-wide AI limits remain enabled.'
echo "Rollback backup: $backup"
