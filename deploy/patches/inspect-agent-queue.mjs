import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const app = '/opt/moradi-apps/ideaapp';
const pid = process.argv[2];
if (!/^\d+$/.test(pid ?? '')) { console.log('Invalid PID'); process.exit(1); }
try {
  const raw = await readFile(`/proc/${pid}/environ`, 'utf8');
  for (const part of raw.split('\0')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === 'DATABASE_URL') process.env.DATABASE_URL = part.slice(i + 1);
  }
  const fromApp = createRequire(`${app}/package.json`);
  fromApp('@next/env').loadEnvConfig(app, false, {info(){},warn(){},error(){}});
  if (!process.env.DATABASE_URL) throw Error('Missing database configuration');
  const sql = fromApp('postgres')(process.env.DATABASE_URL, {max:1,connect_timeout:8,idle_timeout:1,prepare:false});
  try {
    const result = await sql.begin('read only', async tx => {
      const counts = await tx`select status, coalesce(input->>'kind','unknown') as kind, count(*)::int as count from workflow_runs where status in ('queued','running') group by status,input->>'kind' order by status,kind`;
      const recent = await tx`select status, coalesce(input->>'kind','unknown') as kind, attempts, created_at from workflow_runs order by created_at desc limit 1`;
      return {active: counts, latest: recent[0] ?? null};
    });
    console.log(JSON.stringify(result,null,2));
  } finally { await sql.end({timeout:2}); }
} catch { console.error('Queue inspection failed; no credentials were printed.'); process.exitCode=1; }
