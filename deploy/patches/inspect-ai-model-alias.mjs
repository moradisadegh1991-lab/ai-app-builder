import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const app='/opt/moradi-apps/ideaapp', pid=process.argv[2];
if(!/^\d+$/.test(pid??'')){console.error('Invalid PID');process.exit(1)}
try {
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');
 for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&part.slice(0,i)==='DATABASE_URL')process.env.DATABASE_URL=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);
 req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 try {
  const result=await sql.begin('read only',async tx=>{
   const [run]=await tx`select user_id from workflow_runs where input->>'kind'='code' order by created_at desc limit 1`;
   if(!run)return {status:'no-code-run'};
   const summary=await tx`select state,count(*)::int as count,coalesce(sum(reserved_toman),0)::text as reserved_toman from usage_reservations where used_platform_key and user_id=${run.user_id}::uuid and state<>'released' and created_at>=now()-interval '24 hours' group by state order by state`;
   const entries=await tx`select r.state,r.reserved_toman::text as reserved_toman,r.created_at,u.estimated_cost_toman::text as estimated_cost_toman,u.input_tokens,u.output_tokens,u.agent_role,case when u.model ~ '^[a-zA-Z0-9._:/-]{1,128}$' then u.model else '[redacted]' end as billed_model,wr.input->>'kind' as run_kind from usage_reservations r left join usage_records u on u.reservation_id=r.id left join workflow_runs wr on wr.id=r.run_id where r.used_platform_key and r.user_id=${run.user_id}::uuid and r.state<>'released' and r.created_at>=now()-interval '24 hours' order by r.created_at desc limit 20`;
   return {summary,entries};
  });
  console.log(JSON.stringify(result,null,2));
 } finally {await sql.end({timeout:2})}
} catch {console.error('Reservation inspection failed; no credentials were printed.');process.exitCode=1}
