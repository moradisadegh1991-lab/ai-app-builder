import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const app='/opt/moradi-apps/ideaapp',pid=process.argv[2],audit=process.argv[3];
try {
 if(!/^\d+$/.test(pid??'')||!/^\/root\/ideaapp-kimi-ledger-before-[0-9a-f-]+\.json$/.test(audit??''))throw Error('invalid arguments');
 const saved=JSON.parse(await readFile(audit,'utf8'));
 if(!/^[0-9a-f-]{36}$/.test(saved.record_id??'')||!/^[0-9a-f-]{36}$/.test(saved.reservation_id??''))throw Error('invalid audit');
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');
 for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&['DATABASE_URL','AI_TOMAN_LIMITS_JSON'].includes(part.slice(0,i)))process.env[part.slice(0,i)]=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);
 req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 const limits=JSON.parse(process.env.AI_TOMAN_LIMITS_JSON??'{}');
 const code=await readFile(`${app}/src/lib/ai/index.ts`,'utf8');
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 try {
  const report=await sql.begin('read only',async tx=>{
   const [row]=await tx`select r.status,r.attempts,r.error,r.input->>'kind' as kind,
     (p.spec is not null and p.spec_approved_at is not null and p.spec_approved_at<=r.created_at) as original_spec,
     (p.current_generation_id is not distinct from r.base_generation_id) as generation_unchanged,
     (u.provider='arvan') as provider_ok,(u.gateway='api.arvancloudai.ir') as gateway_ok,
     (u.model='moonshotai/kimi-k2.6') as model_ok,(u.agent_role='frontend') as role_ok,
     (u.input_tokens=4194 and u.output_tokens=25815) as tokens_ok,u.used_platform_key as platform_key,
     (u.estimated_cost_toman=34319) as amount_ok,jsonb_typeof(u.tariff_snapshot) as snapshot_type,
     (u.tariff_snapshot->>'source'='public-reference') as snapshot_source_ok,
     (u.user_id=r.user_id) as user_ok,(u.project_id=p.id) as project_ok,
     (u.provider='arvan' and u.gateway='api.arvancloudai.ir' and u.model='moonshotai/kimi-k2.6' and u.agent_role='frontend' and u.input_tokens=4194 and u.output_tokens=25815 and u.used_platform_key and u.estimated_cost_toman=34319 and u.tariff_snapshot->>'source'='public-reference' and u.user_id=r.user_id and u.project_id=p.id) as ledger_matches,
     (z.id=u.reservation_id and z.run_id=r.id and z.user_id=r.user_id and z.project_id=p.id and z.used_platform_key and z.state='settled' and z.reserved_toman=125507) as reservation_matches,
     r.id::text as run_id
     from usage_records u join usage_reservations z on z.id=u.reservation_id join workflow_runs r on r.id=u.run_id join projects p on p.id=r.project_id and p.user_id=r.user_id
     where u.id=${saved.record_id}::uuid and u.reservation_id=${saved.reservation_id}::uuid`;
   const [active]=await tx`select count(*)::int as count from workflow_runs where status in ('queued','running')`;
   const [unknown]=await tx`select count(*)::int as count from usage_records u where u.used_platform_key and u.created_at>=now()-interval '30 days' and (u.estimated_cost_toman is null or u.reservation_id is null or not exists(select 1 from usage_reservations z where z.id=u.reservation_id and z.reserved_toman is not null))`;
   const [holds]=await tx`select count(*)::int as count from usage_reservations where used_platform_key and state='held' and created_at>=now()-interval '30 days' and reserved_toman is null`;
   if(!row)return {record_found:false,active:active.count,unknown:unknown.count,unknown_holds:holds.count};
   const checkpoints=await tx`select key,role,status,output is not null as saved from agent_tasks where run_id=${row.run_id}::uuid order by key`;
   const error=String(row.error??'').toLowerCase();
   const category=/بودجه|سقف|budget/.test(error)?'budget':/قیمت|pricing|tariff/.test(error)?'pricing':/429/.test(error)?'rate-limit':/401|403/.test(error)?'authentication':/402|balance/.test(error)?'credit':/timeout|timed out/.test(error)?'timeout':/json|ساختار/.test(error)?'json':/sandbox|docker|ابزار ارزیابی/.test(error)?'sandbox':'other-or-none';
   return {record_found:true,original_status:row.status,attempts:row.attempts,kind:row.kind,error_category:category,original_spec:row.original_spec,generation_unchanged:row.generation_unchanged,ledger_matches:row.ledger_matches,reservation_matches:row.reservation_matches,ledger_details:{provider_ok:row.provider_ok,gateway_ok:row.gateway_ok,model_ok:row.model_ok,role_ok:row.role_ok,tokens_ok:row.tokens_ok,platform_key:row.platform_key,amount_ok:row.amount_ok,snapshot_type:row.snapshot_type,snapshot_source_ok:row.snapshot_source_ok,user_ok:row.user_ok,project_ok:row.project_ok},active:active.count,unknown:unknown.count,unknown_holds:holds.count,checkpoints};
  });
  report.alias_fix_installed=code.includes('result.model === "moonshotai/kimi-k2.6"');
  report.backup_estimate_matches=saved.new_estimated_cost_toman===34319;
  report.budget_ceiling_matches=limits.common?.platform_month===2000000&&limits.common?.platform_day===500000&&limits.free?.user_month===500000&&limits.free?.project_month===500000;
  console.log(JSON.stringify(report,null,2));
 } finally {await sql.end({timeout:2})}
} catch {console.error('Read-only diagnosis stopped; no credentials were printed.');process.exitCode=1}
