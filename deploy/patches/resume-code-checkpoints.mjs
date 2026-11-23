import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const app='/opt/moradi-apps/ideaapp';

// Run within a transaction protected by the same budget lock as AI reservations.
export async function resume(query,audit,recordId,reservationId) {
 await query('select pg_advisory_xact_lock(19871205)');
 const active=await query("select count(*)::int as count from workflow_runs where status in ('queued','running')");
 if(Number(active[0]?.count)!==0)throw Error('Active work exists');
 const candidates=await query(`select r.id::text as id,r.project_id::text as project_id,r.user_id::text as user_id,
   p.last_error, r.status,r.attempts,r.error
   from usage_records u join usage_reservations z on z.id=u.reservation_id
   join workflow_runs r on r.id=u.run_id join projects p on p.id=r.project_id and p.user_id=r.user_id
   where u.id=$1::uuid and u.reservation_id=$2::uuid and u.provider='arvan'
     and u.gateway='api.arvancloudai.ir' and u.model='moonshotai/kimi-k2.6'
     and u.agent_role='frontend' and u.input_tokens=4194 and u.output_tokens=25815
     and u.used_platform_key and u.estimated_cost_toman=34319
     and u.tariff_snapshot->>'source'='public-reference'
     and u.user_id=r.user_id and u.project_id=p.id
     and z.id=u.reservation_id and z.run_id=r.id and z.user_id=r.user_id and z.project_id=p.id
     and z.used_platform_key and z.state='settled' and z.reserved_toman=125507
     and r.input->>'kind'='code' and r.status='failed' and r.attempts<3 and (r.error like '%بودجه%' or r.error like '%سقف%')
     and p.spec is not null and p.spec_approved_at is not null and p.spec_approved_at<=r.created_at
     and p.current_generation_id is not distinct from r.base_generation_id
   for update of r,p`,[recordId,reservationId]);
 if(candidates.length!==1)throw Error('Original run no longer eligible');
 const r=candidates[0];
 const checkpoints=await query('select key,role,status,output is not null as saved from agent_tasks where run_id=$1::uuid order by key',[r.id]);
 for(const [key,role] of [['architecture','architect'],['design','designer'],['frontend','frontend']]){
  if(!checkpoints.some(x=>x.key===key&&x.role===role&&x.status==='succeeded'&&x.saved))throw Error('Required checkpoint missing');
 }
 if(!checkpoints.some(x=>x.key==='backend'&&x.role==='backend'&&x.status==='failed'))throw Error('Expected failed backend not found');
 const unknown=await query(`select count(*)::int as count from usage_records u where u.used_platform_key and u.created_at>=now()-interval '30 days' and (u.estimated_cost_toman is null or u.reservation_id is null or not exists(select 1 from usage_reservations z where z.id=u.reservation_id and z.reserved_toman is not null))`);
 const unknownHolds=await query("select count(*)::int as count from usage_reservations where used_platform_key and state='held' and created_at>=now()-interval '30 days' and reserved_toman is null");
 if(Number(unknown[0]?.count)!==0||Number(unknownHolds[0]?.count)!==0)throw Error('Unpriced usage exists');
 await audit({original_run_id:r.id,project_id:r.project_id,previous_project_error:r.last_error,previous_run_error:r.error,checkpoints:checkpoints.map(({key,role,status})=>({key,role,status}))});
 const queued=await query(`update workflow_runs set status='queued',owner_token=null,lease_expires_at=null,
   finished_at=null,error=null,updated_at=now() where id=$1::uuid and status='failed' returning id`,[r.id]);
 if(queued.length!==1)throw Error('Could not queue the original run');
 await query('update projects set last_error=null,updated_at=now() where id=$1::uuid',[r.project_id]);
 return {queued:true,reusable_checkpoints:['architecture','design','frontend']};
}
async function main(){
 const pid=process.argv[2], backup=process.argv[3];
 if(!/^\d+$/.test(pid??'')||!/^\/root\/ideaapp-kimi-ledger-before-[0-9a-f-]+\.json$/.test(backup??''))throw Error('Invalid arguments');
 const old=JSON.parse(await readFile(backup,'utf8'));
 if(!/^[0-9a-f-]{36}$/.test(old.record_id??'')||!/^[0-9a-f-]{36}$/.test(old.reservation_id??'')||old.new_estimated_cost_toman!==34319)throw Error('Invalid reconciliation backup');
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');
 for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&['DATABASE_URL','AI_TOMAN_LIMITS_JSON'].includes(part.slice(0,i)))process.env[part.slice(0,i)]=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);
 req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 const limits=JSON.parse(process.env.AI_TOMAN_LIMITS_JSON??'{}');
 if(limits.common?.platform_month!==2000000||limits.common?.platform_day!==500000||limits.free?.user_month!==500000||limits.free?.user_day!==500000||limits.free?.project_day!==500000)throw Error('Budget configuration mismatch');
 if(!process.env.DATABASE_URL)throw Error('Database configuration unavailable');
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 let auditPath;
 try {
  const result=await sql.begin(tx=>resume((q,p=[])=>tx.unsafe(q,p),async data=>{
   const marker=createHash('sha256').update(old.record_id).digest('hex').slice(0,16);
   auditPath=`/root/ideaapp-before-checkpoint-retry-${marker}.json`;
   await writeFile(auditPath,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});
  },old.record_id,old.reservation_id));
  console.log(JSON.stringify({...result,audit:auditPath},null,2));
 } finally {await sql.end({timeout:2})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Retry preparation stopped; no database details were printed.');process.exitCode=1});
