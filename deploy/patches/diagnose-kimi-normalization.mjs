import {readFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {normalize} from '/tmp/ideaapp-normalize-kimi.mjs';
const app='/opt/moradi-apps/ideaapp',pid=process.argv[2],backup=process.argv[3];
try {
 if(!/^\d+$/.test(pid??'')||!/^\/root\/ideaapp-kimi-ledger-before-[0-9a-f-]+\.json$/.test(backup??''))throw Error('arguments');
 const old=JSON.parse(await readFile(backup,'utf8'));
 if(!/^[0-9a-f-]{36}$/.test(old.record_id??'')||!/^[0-9a-f-]{36}$/.test(old.reservation_id??''))throw Error('backup');
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');
 for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&part.slice(0,i)==='DATABASE_URL')process.env.DATABASE_URL=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);
 req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 let reason='unknown',sqlstate=null;
 try {
  try {await sql.begin(tx=>normalize((q,p=[])=>tx.unsafe(q,p),async()=>{throw Error('READ_ONLY_PREVIEW_PASSED')},old.record_id,old.reservation_id))}
  catch(e){const allowed=['READ_ONLY_PREVIEW_PASSED','Active work exists','Exact record not found','Unexpected prior snapshot'];reason=allowed.includes(e?.message)?e.message:'other';if(/^[0-9A-Z]{5}$/.test(e?.code??''))sqlstate=e.code}
  const [row]=await sql`select jsonb_typeof(tariff_snapshot) as json_type,tariff_snapshot #>> '{}' as snapshot_text,estimated_cost_toman::text as estimate from usage_records where id=${old.record_id}::uuid`;
  let value=row?.snapshot_text,depth=0;
  while(typeof value==='string'&&depth<3){try{value=JSON.parse(value);depth++}catch{break}}
  const rates=value&&typeof value==='object'&&!Array.isArray(value)?{input_ok:value.inputTomanPerMillion===304000,output_ok:value.outputTomanPerMillion===1280000,date_ok:value.updatedAt==='2026-11-22T00:00:00Z',source_ok:value.source==='public-reference',field_count:Object.keys(value).length}:null;
  const marker=createHash('sha256').update(old.record_id).digest('hex').slice(0,16);
  let backupExists=true;try{await access(`/root/ideaapp-kimi-snapshot-before-${marker}.json`)}catch{backupExists=false}
  console.log(JSON.stringify({preview_result:reason,sqlstate,snapshot_type:row?.json_type??null,json_parse_depth:depth,parsed_kind:Array.isArray(value)?'array':typeof value,rates,estimate_matches:Number(row?.estimate)===34319,normalization_backup_exists:backupExists},null,2));
 }finally{await sql.end({timeout:2})}
}catch{console.error('Read-only diagnosis stopped; no credentials were printed.');process.exitCode=1}
