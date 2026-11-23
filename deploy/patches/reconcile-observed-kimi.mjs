import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const app='/opt/moradi-apps/ideaapp';
const rate={inputTomanPerMillion:304000,outputTomanPerMillion:1280000,updatedAt:'2026-11-22T00:00:00Z',source:'public-reference'};
const amount=Math.ceil((4194*rate.inputTomanPerMillion+25815*rate.outputTomanPerMillion)/1000000);

// query() runs within one transaction; backup() must durably record the old values.
export async function reconcile(query, backup) {
  await query('select pg_advisory_xact_lock(19871205)');
  const active=await query("select count(*)::int as count from workflow_runs where status in ('queued','running')");
  if(Number(active[0]?.count)!==0) throw Error('Active work exists');
  const rows=await query(`select u.id::text as id, u.reservation_id::text as reservation_id,
    u.estimated_cost_toman::text as estimated_cost_toman, u.tariff_snapshot,
    r.reserved_toman::text as reserved_toman,r.run_id::text as run_id
    from usage_records u join usage_reservations r on r.id=u.reservation_id
    where u.provider='arvan' and u.gateway='api.arvancloudai.ir'
      and u.model='moonshotai/kimi-k2.6' and u.agent_role='frontend'
      and u.input_tokens=4194 and u.output_tokens=25815 and u.used_platform_key
      and u.estimated_cost_toman is null and u.tariff_snapshot is null
      and r.used_platform_key and r.state='settled' and r.reserved_toman=125507
      and r.created_at >= '2026-11-22T23:55:33.167Z'::timestamptz
      and r.created_at < '2026-11-22T23:55:33.168Z'::timestamptz
      and r.run_id=u.run_id and r.user_id=u.user_id and r.project_id=u.project_id
    for update of u,r`);
  if(rows.length!==1 || amount!==34319) throw Error('Exact record not uniquely found');
  const row=rows[0];
  await backup({record_id:row.id,reservation_id:row.reservation_id,previous_estimated_cost_toman:null,previous_tariff_snapshot:null,reserved_toman:row.reserved_toman,new_estimated_cost_toman:amount,tariff:rate});
  const changed=await query(`update usage_records set estimated_cost_toman=$1::bigint,tariff_snapshot=$2::jsonb where id=$3::uuid and estimated_cost_toman is null and tariff_snapshot is null returning id`,[amount,JSON.stringify(rate),row.id]);
  if(changed.length!==1) throw Error('Record changed during update');
  const checkpoints=await query('select role,status from agent_tasks where run_id=$1::uuid order by created_at,key',[row.run_id]);
  return {estimated_toman:amount,reservation_toman:Number(row.reserved_toman),checkpoints};
}
async function main(){
 const pid=process.argv[2];
 if(!/^\d+$/.test(pid??''))throw Error('Invalid PID');
 const code=await readFile(`${app}/src/lib/ai/index.ts`,'utf8');
 if(!code.includes('result.model === "moonshotai/kimi-k2.6"'))throw Error('Kimi fix not installed');
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');
 for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&part.slice(0,i)==='DATABASE_URL')process.env.DATABASE_URL=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);
 req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 if(!process.env.DATABASE_URL)throw Error('Database configuration unavailable');
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 let backupPath;
 try {
  const outcome=await sql.begin(async tx=>reconcile((query,parameters=[])=>tx.unsafe(query,parameters),async data=>{
    backupPath=`/root/ideaapp-kimi-ledger-before-${randomUUID()}.json`;
    await writeFile(backupPath,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});
  }));
  console.log(JSON.stringify({...outcome,backup:backupPath,source:'public-reference',invoice:false},null,2));
 } finally {await sql.end({timeout:2})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Reconciliation stopped; no database details were printed.');process.exitCode=1});
