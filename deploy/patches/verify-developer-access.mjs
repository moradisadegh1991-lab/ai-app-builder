import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const app='/opt/moradi-apps/ideaapp',pid=process.argv[2];
async function main(){
 if(!/^\d+$/.test(pid??''))throw Error('invalid pid');
 const allowed=['DATABASE_URL','DEVELOPER_GITHUB_IDS','UNLIMITED_EMAILS','AI_TOMAN_LIMITS_JSON'];
 for(const key of allowed)delete process.env[key];
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');
 for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&allowed.includes(part.slice(0,i)))process.env[part.slice(0,i)]=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 let id;
 try{const rows=await sql`select id::text as id from users where github_id=292149705 and lower(github_login)='moradisadegh1991-lab'`;if(rows.length!==1)throw Error('identity mismatch');id=rows[0].id}finally{await sql.end({timeout:2}).catch(()=>{})}
 const subscription=await import(pathToFileURL(`${app}/src/lib/billing/subscription.ts`).href);
 const budgets=await import(pathToFileURL(`${app}/src/lib/workflows/budgets.ts`).href);
 const result=await subscription.activePlan(id);
 const limits=budgets.moneyLimits(process.env.AI_TOMAN_LIMITS_JSON,false,true);
 if(!result.isDeveloper||result.plan.maxProjects!==null||!limits||limits.platform_month!==2000000||limits.platform_day!==500000||limits.user_day!==limits.platform_day||limits.project_day!==limits.platform_day||limits.run!==limits.platform_month)throw Error('developer validation failed');
 process.stdout.write(JSON.stringify({developer_active:true,personal_project_limit:null,personal_token_quota:'unlimited',platform_day_toman:limits.platform_day,platform_month_toman:limits.platform_month})+'\n',()=>process.exit(0));
}
main().catch(()=>{process.stderr.write('Developer verification failed; no sensitive details were printed.\n',()=>process.exit(1))});
