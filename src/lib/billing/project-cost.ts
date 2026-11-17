import { sql } from "drizzle-orm";
import { queryRows } from "../workflows/sql";

/** Estimates are not invoices; unpriced and uncertain calls remain visible. */
export async function projectCost(projectId: string, userId: string) {
  const [row] = await queryRows<{ total: string | number; priced: number; unpriced: number; held: number }>(sql`
    select coalesce(sum(estimated_cost_toman),0)::bigint as total,
      count(*) filter (where estimated_cost_toman is not null)::int as priced,
      count(*) filter (where estimated_cost_toman is null)::int as unpriced,
      (select count(*)::int from usage_reservations r where r.project_id=${projectId}::uuid
         and r.user_id=${userId}::uuid and r.used_platform_key and r.state='held') as held
    from usage_records u where u.project_id=${projectId}::uuid and u.user_id=${userId}::uuid and u.used_platform_key`);
  return { estimatedToman: Number(row?.total ?? 0), pricedCalls: Number(row?.priced ?? 0), unpricedCalls: Number(row?.unpriced ?? 0), heldCalls: Number(row?.held ?? 0) };
}
