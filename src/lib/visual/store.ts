import { sql } from "drizzle-orm";
import { HttpError } from "../http";
import { queryRows } from "../workflows/sql";
import { parseVisualProject, type VisualProject } from "./schema";

export async function loadVisualProject(userId: string, projectId: string) {
  const rows = await queryRows<{ document: VisualProject }>(sql`select v.document from visual_projects v
    join projects p on p.id=v.project_id where p.id=${projectId}::uuid and p.user_id=${userId}::uuid`);
  return rows[0]?.document ?? null;
}

/** Single SQL statement: create only for new projects and update only the expected revision. */
export async function saveVisualProject(userId: string, projectId: string, input: unknown) {
  const parsed = parseVisualProject(input);
  if (!parsed.success) throw new HttpError(400, "داده‌های ویرایشگر معتبر نیستند.");
  const document = parsed.data;
  if (document.revision >= 2147483647) throw new HttpError(400, "تعداد نسخه‌ها به سقف رسیده است.");
  const rows = await queryRows<{ document: VisualProject }>(sql`
    insert into visual_projects(project_id,revision,document)
    select p.id,1,jsonb_set(${JSON.stringify(document)}::jsonb,'{revision}','1'::jsonb) from projects p
      where p.id=${projectId}::uuid and p.user_id=${userId}::uuid and ${document.revision}=0
      and p.current_generation_id is null
    on conflict(project_id) do nothing returning document`);
  if (rows[0]) return rows[0].document;
  const updated = await queryRows<{ document: VisualProject }>(sql`
    update visual_projects v set revision=v.revision+1,
      document=jsonb_set(${JSON.stringify(document)}::jsonb,'{revision}',to_jsonb(v.revision+1)),updated_at=now()
    where v.project_id=${projectId}::uuid and v.revision=${document.revision}
      and exists(select 1 from projects p where p.id=v.project_id and p.user_id=${userId}::uuid)
    returning document`);
  if (!updated[0]) throw new HttpError(409, "نسخه پروژه تغییر کرده یا ویرایش بصری برای این پروژه در دسترس نیست؛ صفحه را تازه کنید.");
  return updated[0].document;
}
