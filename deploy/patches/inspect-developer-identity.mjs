import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const app='/opt/moradi-apps/ideaapp',pid=process.argv[2];
try{
 if(!/^\d+$/.test(pid??''))throw Error('invalid pid');
 const raw=await readFile(`/proc/${pid}/environ`,'utf8');
 for(const part of raw.split('\0')){const i=part.indexOf('=');if(i>0&&['DATABASE_URL','DEVELOPER_GITHUB_IDS'].includes(part.slice(0,i)))process.env[part.slice(0,i)]=part.slice(i+1)}
 const req=createRequire(`${app}/package.json`);req('@next/env').loadEnvConfig(app,false,{info(){},warn(){},error(){}});
 const sql=req('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:8,idle_timeout:1,prepare:false});
 try{
  const result=await sql.begin('read only',async tx=>{
   const [owner]=await tx`select count(*)::int as matches,count(*) filter(where lower(github_login)='moradisadegh1991-lab')::int as login_matches from users where github_id=292149705`;
   const [active]=await tx`select count(*)::int as count from workflow_runs where status in ('queued','running')`;
   return {github_id_matches:owner.matches,login_matches:owner.login_matches,active_workflows:active.count,configured:(process.env.DEVELOPER_GITHUB_IDS??'').split(',').map(x=>x.trim()).includes('292149705')};
  });
  console.log(JSON.stringify(result,null,2));
 }finally{await sql.end({timeout:2}).catch(()=>{})}
}catch{console.error('Read-only identity check stopped; no credentials were printed.');process.exitCode=1}
