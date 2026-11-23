import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resume} from '/tmp/ideaapp-resume-code.mjs';
const app='/opt/moradi-apps/ideaapp',pid=process.argv[2],backup=process.argv[3];
try{
 if(!/^\d+$/.test(pid??'')||!/^\/root\/ideaapp-kimi-ledger-before-[0-9a-f-]+\.json$/.test(backup??''))throw Error('arguments');
 const old=JSON.parse(await readFile(backup,'utf8'));
 if(!/^[0-9a-f-]{36}$/.test(old.record_id??'')||!/^[0-9a-f-]{36}$/.test(old.reservation_id??''))throw Error('backup');
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');
 for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&['DATABASE_URL','AI_TOMAN_LIMITS_JSON'].includes(part.slice(0,i)))process.env[part.slice(0,i)]=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 const limits=JSON.parse(process.env.AI_TOMAN_LIMITS_JSON??'{}');
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 let reason='unknown',state=null,step=null,checkpoints=null;
 try{
  try{await sql.begin(tx=>resume(async(q,p=[])=>{step=q.includes('pg_advisory')?'lock':q.includes('select count')?'count':q.includes('from usage_records u join')?'candidate':q.includes('from agent_tasks')?'checkpoints':'other';const rows=await tx.unsafe(q,p);if(step==='checkpoints')checkpoints=rows.map(x=>({key:x.key,role:x.role,status:x.status,saved:x.saved,saved_type:typeof x.saved}));return rows},async()=>{throw Error('READ_ONLY_PREVIEW_PASSED')},old.record_id,old.reservation_id))}
  catch(e){const known=['READ_ONLY_PREVIEW_PASSED','Active work exists','Original run no longer eligible','Required checkpoint missing','Expected failed backend not found','Unpriced usage exists'];reason=known.includes(e?.message)?e.message:'other';if(/^[0-9A-Z]{5}$/.test(e?.code??''))state=e.code}
  const code=await readFile(`${app}/src/lib/ai/index.ts`,'utf8');
  const report={preview_result:reason,sqlstate:state,last_query_category:step,checkpoints,backup_estimate_matches:old.new_estimated_cost_toman===34319,alias_fix_installed:code.includes('result.model === "moonshotai/kimi-k2.6"'),budget_ceiling_matches:limits.common?.platform_month===2000000&&limits.common?.platform_day===500000&&limits.free?.user_month===500000&&limits.free?.project_month===500000};
  console.log(JSON.stringify(report,null,2));
 }finally{await sql.end({timeout:2})}
}catch{console.error('Read-only diagnosis stopped; no credentials were printed.');process.exitCode=1}
