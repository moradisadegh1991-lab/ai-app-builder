#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

app=/opt/moradi-apps/ideaapp
stage=${1:?Usage: activate-arvan-catalog.sh /tmp/ideaapp-catalog.XXXXXX [--check|--activate]}
mode=${2:---check}
patch="$stage/arvan-catalog-applied.patch"
tag=0014_arvan_model_catalog
migration_hash=e011f922ca7cbb13d21b4304e300fd303334e27b6848d89cd35433f0cfaf6ca3
web=moradi-ideaapp.service
spec=moradi-ideaapp-spec-worker.service
code=moradi-ideaapp-code-worker.service
fail_preflight() {
  printf 'Preflight stopped: %s. Production files and database were not changed.\n' "$*" >&2
  exit 1
}
[[ "$mode" == --check || "$mode" == --activate ]] || fail_preflight "unknown mode $mode"
[[ $(id -u) == 0 ]] || fail_preflight "run as root"
[[ "$stage" =~ ^/tmp/ideaapp-catalog\.[a-zA-Z0-9]+$ ]] || fail_preflight "unexpected stage path $stage"
[[ -d "$stage" ]] || fail_preflight "stage directory is missing: $stage"
[[ $(realpath "$stage") == "$stage" ]] || fail_preflight "stage path resolves elsewhere"
stage_owner_mode=$(stat -c '%u:%a' "$stage") || fail_preflight "cannot inspect stage ownership"
[[ "$stage_owner_mode" == 0:700 ]] || fail_preflight "stage owner/mode is $stage_owner_mode, expected 0:700"
[[ -s "$stage/.next/BUILD_ID" ]] || fail_preflight "staged build has no BUILD_ID"
[[ -s "$app/.next/BUILD_ID" ]] || fail_preflight "active installation has no BUILD_ID to back up at $app/.next/BUILD_ID"
echo 'Preflight: both build artifacts found.'
[[ -f "$patch" && ! -L "$patch" ]] || fail_preflight 'stage patch is missing'
read -r patch_hash _ < <(sha256sum -- "$patch")
case "$patch_hash" in
  f7233ed16296501b7f13cf3411262bc3f6901c2b999040bf8cdfd38880fe34cc|b41d649305694670c9669a195b5beebad84416e79afe16a3c19e23a9814799a5) ;;
  *) fail_preflight 'unrecognized catalog patch checksum' ;;
esac
echo 'Catalog patch checksum verified.' 
printf '%s  %s\n' "$migration_hash" "$stage/drizzle/$tag.sql" | sha256sum -c
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
  [[ "$path" =~ ^(src/|drizzle/0014_arvan_model_catalog\.sql$) && "$path" != *..* ]] || fail_preflight "unexpected patch path"
  files+=("$path")
done < <(git apply --numstat "$patch")
(("${#files[@]}" > 0)) || fail_preflight "no patch files found"
verify=$(mktemp -d /tmp/ideaapp-rollout-verify.XXXXXX)
trap 'rm -rf -- "$verify"' EXIT
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
existing+=(drizzle/meta/_journal.json drizzle/all-in-one.sql)
for file in drizzle/meta/_journal.json drizzle/all-in-one.sql; do
  [[ -s "$stage/$file" ]] || fail_preflight "staged migration metadata is missing: $file"
done

db_step() {
  local pid
  pid=$(systemctl show "$web" -p MainPID --value)
  node --input-type=module - "$pid" "$app" "$stage" "$1" "${2:-}" <<'JS'
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const [pid, app, stage, action, backup] = process.argv.slice(2);
const when = 1795000000006;
const previous = 1795000000005;
let sql;
let phase = "connection";
try {
  const allowed = new Set(["DATABASE_URL", "DEVELOPER_GITHUB_IDS", "AI_GATEWAY_KIND", "AI_GATEWAY_API_KEY", "AI_GATEWAY_BASE_URL"]);
  for (const key of allowed) delete process.env[key];
  for (const part of readFileSync(`/proc/${pid}/environ`, "utf8").split("\0")) {
    const i = part.indexOf("=");
    if (i > 0 && allowed.has(part.slice(0, i))) process.env[part.slice(0, i)] = part.slice(i + 1);
  }
  const require = createRequire(`${app}/package.json`);
  require("@next/env").loadEnvConfig(app, false, { info() {}, warn() {}, error() {} });
  const url = new URL(process.env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      [...url.searchParams.keys()].some((key) => key !== "sslmode")) throw Error("expected local PostgreSQL");
  sql = require("postgres")(process.env.DATABASE_URL, { max: 1, connect_timeout: 8, prepare: false });
  const migration = readFileSync(`${stage}/drizzle/0014_arvan_model_catalog.sql`, "utf8");
  const hash = createHash("sha256").update(migration).digest("hex");
  if (hash !== "e011f922ca7cbb13d21b4304e300fd303334e27b6848d89cd35433f0cfaf6ca3") throw Error("invalid migration hash");
  phase = "developer identity";
  const [identity] = await sql`select count(*)::int as count from users where github_id=292149705`;
  if (identity.count !== 1 || !process.env.DEVELOPER_GITHUB_IDS?.split(",").map((id) => id.trim()).includes("292149705")) {
    throw Error("developer configuration mismatch");
  }
  async function inspect(tx) {
    const [baseline] = await tx`select
      max(created_at)::bigint as latest,
      count(*) filter(where created_at=${when})::int as matches,
      max(hash) filter(where created_at=${when}) as hash
      from drizzle.__drizzle_migrations`;
    const [objects] = await tx`select
      to_regclass('public.ai_quota_defaults') is not null as has_quotas,
      to_regclass('public.arvan_catalog_settings') is not null as has_catalog,
      (select count(*)::int from information_schema.columns where table_schema='public'
        and table_name='arvan_catalog_settings' and column_name in ('key','value')) as columns`;
    const [runs] = await tx`select count(*)::int as active from workflow_runs where status in ('queued','running')`;
    const latest = Number(baseline.latest);
    const applied = latest === when && baseline.matches === 1 && baseline.hash === hash && objects.has_catalog && objects.columns === 2;
    const clean = latest === previous && baseline.matches === 0 && !objects.has_catalog && objects.columns === 0;
    if (!objects.has_quotas || (!applied && !clean)) throw Error("unexpected schema");
    return { applied, active: runs.active };
  }
  phase = "schema and queue inspection";
  const initial = await sql.begin("read only", inspect);
  if (action === "verify") {
    if (!initial.applied) throw Error("migration missing");
    console.log("Migration 0014 and developer account verified.");
    if (process.env.AI_GATEWAY_KIND === "arvan" && process.env.AI_GATEWAY_BASE_URL === "https://api.arvancloudai.ir/v1" && process.env.AI_GATEWAY_API_KEY) {
      try {
        const response = await fetch("https://api.arvancloudai.ir/v1/models", {
          headers: { Authorization: `apikey ${process.env.AI_GATEWAY_API_KEY.replace(/^apikey\s+/i, "")}` },
          signal: AbortSignal.timeout(6000), redirect: "error",
        });
        const payload = response.ok ? await response.text() : "";
        const data = payload && payload.length <= 1000000 ? JSON.parse(payload)?.data : null;
        if (Array.isArray(data) && data.length <= 3000)
          console.log(JSON.stringify({ gateway_models_reported: new Set(data.map((entry) => entry?.id)
            .filter((id) => typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,149}$/.test(id))).size }));
        else console.log(JSON.stringify({ gateway_catalog: "unavailable", status: response.status }));
      } catch {
        console.log(JSON.stringify({ gateway_catalog: "unavailable" }));
      }
    }
  } else {
    console.log(JSON.stringify({ local_postgres: true, developer_verified: true, migration_applied: initial.applied, active_workflows: initial.active }));
    if (initial.active !== 0) throw Error("workflow in progress");
    phase = "backup utility check";
    const pgDump = spawnSync("pg_dump", ["--version"], { stdio: "ignore" });
    if (pgDump.status !== 0) throw Error("pg_dump unavailable");
    if (action === "apply") {
      phase = "private PostgreSQL backup";
      const dump = spawnSync("pg_dump", ["--no-password", "--format=custom", "--file", `${backup}/database.dump`], {
        env: {
          PATH: process.env.PATH,
          PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
          PGPORT: url.port || "5432",
          PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
          PGUSER: decodeURIComponent(url.username),
          PGPASSWORD: decodeURIComponent(url.password),
          PGSSLMODE: url.searchParams.get("sslmode") ?? "prefer",
          PGCONNECT_TIMEOUT: "8",
        },
        stdio: "ignore",
        timeout: 120_000,
      });
      if (dump.status !== 0) throw Error("backup failed");
      phase = "additive migration";
      await sql.begin(async (tx) => {
        await tx`set local lock_timeout='5s'`;
        await tx`set local statement_timeout='30s'`;
        await tx`select pg_advisory_xact_lock(19871204)`;
        const state = await inspect(tx);
        if (state.active !== 0) throw Error("workflow in progress");
        if (state.applied) return;
        await tx.unsafe(migration.replaceAll("--> statement-breakpoint", ""));
        await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${hash},${when})`;
        if (!(await inspect(tx)).applied) throw Error("verification failed");
      });
      console.log("Migration 0014 applied or already verified.");
    }
  }
} catch {
  console.error(`Catalog rollout could not complete: ${phase}. No credentials printed.`);
  process.exitCode = 1;
} finally {
  if (sql) await sql.end({ timeout: 2 }).catch(() => {});
}
JS
}

db_step check
if [[ "$mode" == --check ]]; then
  echo 'Preflight passed. Source, services and database were not changed.'
  exit 0
fi

backup=$(mktemp -d /root/ideaapp-before-arvan-catalog.XXXXXX)
tar -C "$app" -cf "$backup/source.tar" "${existing[@]}"
db_step apply "$backup"
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
    echo "Previous service restored. Additive database migration retained. Backup: $backup"
  fi
  exit "$rc"
}
trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM
cp -a --reflink=auto "$stage/.next" "$newbuild"
chown -R moradiidea:moradiidea "$newbuild"
services_stopped=1
systemctl stop "$code" "$spec" "$web"
touched=1
for file in "${files[@]}" drizzle/meta/_journal.json drizzle/all-in-one.sql; do
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
  if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3100/api/health 2>/dev/null; then break; fi
  sleep 1
done
curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:3100/api/health
db_step verify
systemctl start "$spec" "$code"
sleep 3
for service in "$web" "$spec" "$code"; do systemctl is-active --quiet "$service"; done
trap - ERR INT TERM
echo "Arvan catalog active. Backup: $backup"
echo "Previous build: $oldbuild"
