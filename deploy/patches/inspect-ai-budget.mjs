import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const app='/opt/moradi-apps/ideaapp', pid=process.argv[2];
if(!/^\d+$/.test(pid??'')){console.error('Invalid service PID');process.exit(1)}
try {
  const raw=await readFile(`/proc/${pid}/environ`,'utf8');
  for(const item of raw.split('\0')) {const i=item.indexOf('='); if(i>0 && ['DATABASE_URL','AI_TOMAN_LIMITS_JSON'].includes(item.slice(0,i))) process.env[item.slice(0,i)]=item.slice(i+1)}
  const req=createRequire(`${app}/package.json`);
  req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
  const limits=JSON.parse(process.env.AI_TOMAN_LIMITS_JSON ?? '{}');
  const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
  try {
    const report=await sql.begin('read only',async tx=>{
      const [run]=await tx`select id,user_id,project_id,status,error from workflow_runs where input->>'kind'='code' order by created_at desc limit 1`;
      if(!run) return {latest:'not found'};
      const [amounts]=await tx`select
        coalesce(sum(reserved_toman) filter(where created_at>=now()-interval '24 hours'),0)::text as platform_day,
        coalesce(sum(reserved_toman),0)::text as platform_month,
        coalesce(sum(reserved_toman) filter(where user_id=${run.user_id}::uuid and created_at>=now()-interval '24 hours'),0)::text as user_day,
        coalesce(sum(reserved_toman) filter(where user_id=${run.user_id}::uuid),0)::text as user_month,
        coalesce(sum(reserved_toman) filter(where project_id=${run.project_id}::uuid and created_at>=now()-interval '24 hours'),0)::text as project_day,
        coalesce(sum(reserved_toman) filter(where run_id=${run.id}::uuid),0)::text as run_amount
        from usage_reservations where used_platform_key and state<>'released' and created_at>=now()-interval '30 days'`;
      const tasks=await tx`select role,status from agent_tasks where run_id=${run.id}::uuid order by created_at,key`;
      const error=String(run.error??'').toLowerCase();
      const classification=/بودجه|سقف|budget/.test(error)?'budget':/قیمت|tariff|pricing/.test(error)?'pricing':/429/.test(error)?'rate-limit':/401|403/.test(error)?'authentication':/402|balance/.test(error)?'provider-credit':/sandbox|docker|ابزار ارزیابی/.test(error)?'sandbox':'other-or-none';
      return {latest_status:run.status,error_category:classification,tasks,spending_reservations_toman:amounts,limits_toman:{common:limits.common??null,free:limits.free??null}};
    });
    console.log(JSON.stringify(report,null,2));
  } finally {await sql.end({timeout:2})}
} catch { console.error('Budget inspection failed; no credentials were printed.'); process.exitCode=1; }
