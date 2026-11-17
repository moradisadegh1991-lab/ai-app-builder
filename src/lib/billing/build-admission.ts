import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { activePlan } from "./subscription";
import { HttpError } from "../http";
import { queryRows } from "../workflows/sql";

/** An uncertain external action retains its admission to prevent repeated builds. */
export async function admitBuild(userId: string, projectId: string, template: string, trigger: "push" | "dispatch") {
  if (template === "web") return null;
  const { plan } = await activePlan(userId);
  if (plan.id !== "free") return null;
  const raw = process.env.FREE_BUILDS_PER_30_DAYS;
  if (!raw || !/^\d{1,4}$/.test(raw)) throw new HttpError(503, "سهمیه ساخت رایگان تنظیم نشده است؛ بعداً دوباره تلاش کنید.");
  const id = randomUUID();
  const rows = await queryRows<{ allowed: boolean }>(sql`select admit_free_build(${id}::uuid,${userId}::uuid,${projectId}::uuid,${trigger},${Number(raw)}) as allowed`);
  if (!rows[0]?.allowed) throw new HttpError(429, "سهمیه ساخت رایگان در ۳۰ روز گذشته کامل شده است.");
  return id;
}

export async function linkBuildAdmission(admission: string | null, buildId: string) {
  if (admission) await queryRows(sql`update build_admissions set build_job_id=${buildId}::uuid where id=${admission}::uuid returning id`);
}
