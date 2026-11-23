import {readFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const app='/opt/moradi-apps/ideaapp',pid=process.argv[2],backup=process.argv[3];
const category=x=>{const s=String(x??'').toLowerCase();return /بودجه|سقف|budget/.test(s)?'budget':/قیمت|pricing|tariff/.test(s)?'pricing':/429/.test(s)?'rate-limit':/401|403/.test(s)?'authentication':/402|balance/.test(s)?'credit':/timeout|timed out/.test(s)?'timeout':/json|ساختار/.test(s)?'json':/sandbox|docker|ابزار ارزیابی/.test(s)?'sandbox':/eacces|permission denied/.test(s)?'permissions':x?'other':'none'};
try{
 if(!/^\d+$/.test(pid??'')||!/^\/root\/ideaapp-kimi-ledger-before-[0-9a-f-]+\.json$/.test(backup??''))throw Error('invalid arguments');
 const old=JSON.parse(await readFile(backup,'utf8'));
 if(!/^[0-9a-f-]{36}$/.test(old.record_id??'')||!/^[0-9a-f-]{36}$/.test(old.reservation_id??''))throw Error('invalid backup');
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');for(const p of raw.split('\0')){const i=p.indexOf('=');if(i>0&&p.slice(0,i)==='DATABASE_URL')process.env.DATABASE_URL=p.slice(i+1)}
 const req=createRequire(`${app}/package.json`);req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 try{
  const report=await sql.begin('read only',async tx=>{
   const [origin]=await tx`select r.id::text as run_id,r.project_id::text as project_id,r.user_id::text as user_id from usage_records u join workflow_runs r on r.id=u.run_id where u.id=${old.record_id}::uuid and u.reservation_id=${old.reservation_id}::uuid`;
   if(!origin)return {origin_found:false};
   const runs=await tx`select id::text as id,status,attempts,error,created_at,updated_at,finished_at from workflow_runs where project_id=${origin.project_id}::uuid and user_id=${origin.user_id}::uuid and input->>'kind'='code' order by created_at desc limit 5`;
   const results=[];
   for(const r of runs){
    const tasks=await tx`select key,role,status,error,output is not null as saved,updated_at from agent_tasks where run_id=${r.id}::uuid order by key`;
    const [money]=await tx`select count(*)::int as count,coalesce(sum(reserved_toman),0)::text as reserved_toman from usage_reservations where run_id=${r.id}::uuid and used_platform_key and state<>'released'`;
    results.push({original:r.id===origin.run_id,status:r.status,attempts:r.attempts,error_category:category(r.error),created_at:r.created_at,updated_at:r.updated_at,finished_at:r.finished_at,reservations:money,tasks:tasks.map(t=>({key:t.key,role:t.role,status:t.status,saved:t.saved,error_category:category(t.error),updated_at:t.updated_at}))});
   }
   const [unpriced]=await tx`select count(*)::int as count from usage_records u where u.used_platform_key and u.created_at>=now()-interval '30 days' and (u.estimated_cost_toman is null or u.reservation_id is null or not exists(select 1 from usage_reservations z where z.id=u.reservation_id and z.reserved_toman is not null))`;
   return {origin_found:true,runs:results,unpriced_records:unpriced.count};
  });
  const marker=createHash('sha256').update(old.record_id).digest('hex').slice(0,16);
  try{await access(`/root/ideaapp-before-checkpoint-retry-${marker}.json`);report.resume_audit_exists=true}catch{report.resume_audit_exists=false}
  console.log(JSON.stringify(report,null,2));
 }finally{await sql.end({timeout:2})}
}catch{console.error('Read-only history inspection stopped; no credentials were printed.');process.exitCode=1}
