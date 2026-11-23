import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const app='/opt/moradi-apps/ideaapp';
const expected=[
 {model:'Gemini-2.5-Pro',role:'architect',input:718,output:2825,cost:9328,old:96282,next:18656,start:'2026-11-22T22:24:29.823Z',end:'2026-11-22T22:24:29.824Z',inrate:400000,outrate:3200000},
 {model:'moonshotai/kimi-k2.6',role:'frontend',input:4194,output:25815,cost:34319,old:125507,next:68638,start:'2026-11-22T23:55:33.167Z',end:'2026-11-22T23:55:33.168Z',inrate:304000,outrate:1280000},
];
export async function prepare(query,audit,recordId,reservationId,preview=false){
 await query('select pg_advisory_xact_lock(19871205)');
 const active=await query("select count(*)::int as count from workflow_runs where status in ('queued','running')");
 if(Number(active[0]?.count)!==0)throw Error('Active work exists');
 const runs=await query(`select r.id::text as id,r.user_id::text as user_id,r.project_id::text as project_id,r.error,p.last_error
  from usage_records u join usage_reservations z on z.id=u.reservation_id
  join projects p on p.id=u.project_id and p.user_id=u.user_id
  join workflow_runs r on r.project_id=p.id and r.user_id=p.user_id
  where u.id=$1::uuid and z.id=$2::uuid and u.reservation_id=z.id
   and u.provider='arvan' and u.gateway='api.arvancloudai.ir' and u.model='moonshotai/kimi-k2.6'
   and u.agent_role='frontend' and u.input_tokens=4194 and u.output_tokens=25815
   and u.estimated_cost_toman=34319 and u.tariff_snapshot->>'source'='public-reference'
   and z.state='settled' and z.reserved_toman=125507
   and r.id=(select r2.id from workflow_runs r2 where r2.project_id=p.id and r2.user_id=p.user_id and r2.input->>'kind'='code' order by r2.created_at desc limit 1)
   and r.input->>'kind'='code' and r.status='failed' and r.attempts<3
   and (r.error like '%بودجه%' or r.error like '%سقف%')
   and r.created_at>='2026-11-23T12:33:01.644Z'::timestamptz and r.created_at<'2026-11-23T12:33:01.645Z'::timestamptz
   and p.spec is not null and p.spec_approved_at is not null and p.spec_approved_at<=r.created_at
   and p.current_generation_id is not distinct from r.base_generation_id
  for update of r,p`,[recordId,reservationId]);
 if(runs.length!==1)throw Error('Latest run no longer eligible');
 const run=runs[0];
 const tasks=await query('select key,role,status,output is not null as saved from agent_tasks where run_id=$1::uuid order by key',[run.id]);
 for(const [key,role] of [['architecture','architect'],['design','designer'],['backend','backend']])if(!tasks.some(x=>x.key===key&&x.role===role&&x.status==='succeeded'&&x.saved))throw Error('Required checkpoint missing');
 if(!tasks.some(x=>x.key==='frontend'&&x.role==='frontend'&&x.status==='failed'))throw Error('Expected failed frontend missing');
 const unknown=await query(`select count(*)::int as count from usage_records u where u.used_platform_key and u.created_at>=now()-interval '30 days' and (u.estimated_cost_toman is null or u.reservation_id is null or not exists(select 1 from usage_reservations z where z.id=u.reservation_id and z.reserved_toman is not null))`);
 const unknownHolds=await query("select count(*)::int as count from usage_reservations where used_platform_key and state='held' and created_at>=now()-interval '30 days' and reserved_toman is null");
 if(Number(unknown[0]?.count)!==0||Number(unknownHolds[0]?.count)!==0)throw Error('Unpriced usage exists');
 const matches=[];
 for(const e of expected){
  const rows=await query(`select u.id::text as record_id,z.id::text as reservation_id,u.tariff_snapshot::text as snapshot_text
   from usage_records u join usage_reservations z on z.id=u.reservation_id
   where u.user_id=$1::uuid and u.project_id=$2::uuid and u.provider='arvan' and u.gateway='api.arvancloudai.ir'
    and u.model=$3 and u.agent_role=$4 and u.input_tokens=$5 and u.output_tokens=$6
    and u.used_platform_key and u.estimated_cost_toman=$7 and z.used_platform_key and z.state='settled' and z.reserved_toman=$8
    and z.user_id=u.user_id and z.project_id=u.project_id and z.run_id=u.run_id
    and z.created_at >= $9::timestamptz and z.created_at < $10::timestamptz
   for update of u,z`,[run.user_id,run.project_id,e.model,e.role,e.input,e.output,e.cost,e.old,e.start,e.end]);
  if(rows.length!==1)throw Error('Expected settled reservation missing');
  let snapshot=JSON.parse(rows[0].snapshot_text);if(typeof snapshot==='string')snapshot=JSON.parse(snapshot);
  if(!snapshot||snapshot.source!=='public-reference'||snapshot.updatedAt!=='2026-11-22T00:00:00Z'||snapshot.inputTomanPerMillion!==e.inrate||snapshot.outputTomanPerMillion!==e.outrate||e.next!==2*e.cost)throw Error('Tariff evidence mismatch');
  matches.push({...rows[0],old:e.old,next:e.next,role:e.role});
 }
 const info={eligible:true,reusable_checkpoints:['architecture','design','backend'],settled_reservations:matches.map(({role,old,next})=>({role,old_toman:old,new_toman:next}))};
 if(preview)return info;
 await audit({run_id:run.id,project_id:run.project_id,previous_run_error:run.error,previous_project_error:run.last_error,reservations:matches.map(({record_id,reservation_id,role,old,next})=>({record_id,reservation_id,role,old_toman:old,new_toman:next}))});
 for(const m of matches){
  const changed=await query("update usage_reservations set reserved_toman=$2::bigint where id=$1::uuid and state='settled' and reserved_toman=$3::bigint returning id",[m.reservation_id,m.next,m.old]);
  if(changed.length!==1)throw Error('Reservation changed');
 }
 const queued=await query("update workflow_runs set status='queued',owner_token=null,lease_expires_at=null,finished_at=null,error=null,updated_at=now() where id=$1::uuid and status='failed' returning id",[run.id]);
 if(queued.length!==1)throw Error('Run changed');
 await query('update projects set last_error=null,updated_at=now() where id=$1::uuid',[run.project_id]);
 return {...info,queued:true};
}
async function main(){
 const pid=process.argv[2],backup=process.argv[3],mode=process.argv[4];
 if(!/^\d+$/.test(pid??'')||!/^\/root\/ideaapp-kimi-ledger-before-[0-9a-f-]+\.json$/.test(backup??'')||!['--check','--apply'].includes(mode))throw Error('Invalid arguments');
 const old=JSON.parse(await readFile(backup,'utf8'));
 if(!/^[0-9a-f-]{36}$/.test(old.record_id??'')||!/^[0-9a-f-]{36}$/.test(old.reservation_id??'')||old.new_estimated_cost_toman!==34319)throw Error('Invalid audit backup');
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&['DATABASE_URL','AI_TOMAN_LIMITS_JSON'].includes(part.slice(0,i)))process.env[part.slice(0,i)]=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 const limits=JSON.parse(process.env.AI_TOMAN_LIMITS_JSON??'{}');
 if(limits.common?.platform_month!==2000000||limits.common?.platform_day!==500000||limits.free?.user_month!==500000||limits.free?.project_month!==500000)throw Error('Monthly limit mismatch');
 if(mode==='--apply'&&(limits.common?.run!==400000||limits.free?.run!==400000||limits.free?.user_day!==500000||limits.free?.project_day!==500000))throw Error('Daily limit mismatch');
 if(!(await readFile(`${app}/src/lib/ai/index.ts`,'utf8')).includes('result.model === "moonshotai/kimi-k2.6"'))throw Error('Kimi fix missing');
 if(!process.env.DATABASE_URL)throw Error('Database configuration unavailable');
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});let auditPath;
 try{
  const result=await sql.begin(tx=>prepare((q,p=[])=>tx.unsafe(q,p),async data=>{
    const marker=createHash('sha256').update(data.run_id).digest('hex').slice(0,16);
    auditPath=`/root/ideaapp-before-latest-retry-${marker}.json`;
    await writeFile(auditPath,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});
   },old.record_id,old.reservation_id,mode==='--check'));
  await sql.end({timeout:2}).catch(()=>{});
  console.log(JSON.stringify({...result,...(auditPath?{audit:auditPath}:{})},null,2));
 }catch{await sql.end({timeout:2}).catch(()=>{});throw Error('Preparation failed')}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Preparation stopped; no database details were printed.');process.exitCode=1});
