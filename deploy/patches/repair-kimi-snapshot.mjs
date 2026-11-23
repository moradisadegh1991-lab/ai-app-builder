import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const app='/opt/moradi-apps/ideaapp';
const expected={inputTomanPerMillion:304000,outputTomanPerMillion:1280000,updatedAt:'2026-11-22T00:00:00Z',source:'public-reference'};
export async function normalize(query,audit,recordId,reservationId){
 await query('select pg_advisory_xact_lock(19871205)');
 const active=await query("select count(*)::int as count from workflow_runs where status in ('queued','running')");
 if(Number(active[0]?.count)!==0)throw Error('Active work exists');
 const rows=await query(`select u.id::text as id,u.reservation_id::text as reservation_id,
    u.tariff_snapshot #>> '{}' as snapshot_text,r.reserved_toman::text as reserved_toman
   from usage_records u join usage_reservations r on r.id=u.reservation_id
   where u.id=$1::uuid and u.reservation_id=$2::uuid and u.provider='arvan'
    and u.gateway='api.arvancloudai.ir' and u.model='moonshotai/kimi-k2.6' and u.agent_role='frontend'
    and u.input_tokens=4194 and u.output_tokens=25815 and u.used_platform_key
    and u.estimated_cost_toman=34319 and jsonb_typeof(u.tariff_snapshot)='string'
    and r.used_platform_key and r.state='settled' and r.reserved_toman=125507
    and r.created_at>='2026-11-22T23:55:33.167Z'::timestamptz
    and r.created_at<'2026-11-22T23:55:33.168Z'::timestamptz
    and r.run_id=u.run_id and r.user_id=u.user_id and r.project_id=u.project_id
   for update of u,r`,[recordId,reservationId]);
 if(rows.length!==1)throw Error('Exact record not found');
 const row=rows[0];
 const actual=JSON.parse(row.snapshot_text);
 if(!actual || typeof actual!=='object' || Array.isArray(actual) || Object.keys(actual).length!==4 || Object.entries(expected).some(([k,v])=>actual[k]!==v))throw Error('Unexpected prior snapshot');
 await audit({record_id:row.id,reservation_id:row.reservation_id,previous_snapshot:row.snapshot_text,estimated_toman:34319,reserved_toman:row.reserved_toman});
 const changed=await query(`update usage_records set tariff_snapshot=jsonb_build_object(
   'inputTomanPerMillion',304000::bigint,'outputTomanPerMillion',1280000::bigint,
   'updatedAt','2026-11-22T00:00:00Z'::text,'source','public-reference'::text)
   where id=$1::uuid and estimated_cost_toman=34319 and jsonb_typeof(tariff_snapshot)='string'
   and tariff_snapshot #>> '{}'=$2::text returning jsonb_typeof(tariff_snapshot) as type`,[row.id,row.snapshot_text]);
 if(changed.length!==1||changed[0].type!=='object')throw Error('Snapshot changed during update');
 return {snapshot_type:'object',estimated_toman:34319,reservation_toman:Number(row.reserved_toman)};
}
async function main(){
 const pid=process.argv[2],backup=process.argv[3];
 if(!/^\d+$/.test(pid??'')||!/^\/root\/ideaapp-kimi-ledger-before-[0-9a-f-]+\.json$/.test(backup??''))throw Error('Invalid arguments');
 const old=JSON.parse(await readFile(backup,'utf8'));
 if(!/^[0-9a-f-]{36}$/.test(old.record_id??'')||!/^[0-9a-f-]{36}$/.test(old.reservation_id??'')||old.new_estimated_cost_toman!==34319)throw Error('Invalid audit backup');
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');
 for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&part.slice(0,i)==='DATABASE_URL')process.env.DATABASE_URL=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);
 req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 if(!process.env.DATABASE_URL)throw Error('Database configuration unavailable');
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 let auditPath;
 try {
  const result=await sql.begin(tx=>normalize((q,p=[])=>tx.unsafe(q,p),async data=>{
   const marker=createHash('sha256').update(old.record_id).digest('hex').slice(0,16);
   auditPath=`/root/ideaapp-kimi-snapshot-before-${marker}.json`;
   await writeFile(auditPath,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});
  },old.record_id,old.reservation_id));
  console.log(JSON.stringify({...result,audit:auditPath},null,2));
 } finally {await sql.end({timeout:2})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Snapshot repair stopped; no database details were printed.');process.exitCode=1});
