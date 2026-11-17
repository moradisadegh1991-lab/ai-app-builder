import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { activePlan } from "../billing/subscription";
import { HttpError } from "../http";
import { queryRows } from "./sql";

export function tokenReservation(
  system: string,
  prompt: string,
  maxOutputTokens: number,
  images: { data: string }[] = [],
) {
  // Reserve conservatively in UTF-8 bytes. Image decoding/tokenization is model-specific;
  // reserve 4096 per image and always settle with the provider's measured usage.
  return Buffer.byteLength(system + prompt, "utf8") + maxOutputTokens + images.length * 4096;
}
type MoneyReservation = { projectId?: string; amount: number };
const moneyKeys = ["platform_day", "platform_month", "user_day", "user_month", "project_day", "project_month", "run"] as const;

/** Limits are explicit administrator configuration; never infer financial limits from plan prices. */
export function moneyLimits(raw: string | undefined, free: boolean): Record<string, number> | null {
  try {
    const config = JSON.parse(raw ?? "") as { common?: Record<string, unknown>; free?: Record<string, unknown> };
    const common = config.common, trial = config.free;
    if (!common || !trial) return null;
    const limits: Record<string, number> = {};
    for (const k of moneyKeys) {
      const v = common[k], f = trial[k];
      if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > 999_999_999_999 ||
          typeof f !== "number" || !Number.isSafeInteger(f) || f < 0 || f > 999_999_999_999) return null;
      // Platform limits are shared; a free user cannot lower the platform-wide cap for others.
      limits[k] = free && !k.startsWith("platform_") ? Math.min(v, f) : v;
    }
    return limits;
  } catch { return null; }
}
export async function reserveUsage(userId: string, runId: string | undefined, tokens: number, platform: boolean, money?: MoneyReservation) {
  const id = randomUUID();
  const { plan } = await activePlan(userId);
  if (platform && (!money || !Number.isSafeInteger(money.amount) || money.amount < 1))
    throw new HttpError(503, "هزینهٔ این مدل قابل تأیید نیست؛ تنظیمات قیمت را بررسی کنید.");
  const limits = platform ? moneyLimits(process.env.AI_TOMAN_LIMITS_JSON, plan.id === "free") : null;
  if (platform && !limits) throw new HttpError(503, "سقف هزینهٔ سرویس تنظیم نشده است؛ لطفاً بعداً تلاش کنید.");
  const rows = platform
    ? await queryRows<{ allowed: boolean }>(sql`select reserve_ai_money(${id}::uuid,${userId}::uuid,${money!.projectId ?? null}::uuid,${runId ?? null}::uuid,
        ${tokens},${plan.windowTokens}::bigint,${plan.weeklyTokens}::bigint,${money!.amount}::bigint,${JSON.stringify(limits)}::jsonb) as allowed`)
    : await queryRows<{ allowed: boolean }>(sql`select reserve_ai_usage(${id}::uuid,${userId}::uuid,${runId ?? null}::uuid,
        ${tokens},false,${plan.windowTokens}::bigint,${plan.weeklyTokens}::bigint) as allowed`);
  if (!rows[0]?.allowed) throw new HttpError(429, "بودجهٔ باقی‌مانده کافی نیست یا مصرف قبلی نیاز به بررسی دارد.");
  return id;
}
export async function settleUsage(
  id: string,
  details: {
    projectId?: string;
    provider: string;
    model: string;
    purpose: string;
    inputTokens: number;
    outputTokens: number;
    runId?: string;
    role?: string;
    gateway?: string;
    estimatedCostToman?: number | null;
    tariffSnapshot?: { inputTomanPerMillion: number; outputTomanPerMillion: number; updatedAt: string; source: string } | null;
  },
) {
  // A single statement prevents a retry from recording usage twice.
  await queryRows(sql`with guard as (select pg_advisory_xact_lock(19871205)), settled as (
    update usage_reservations set state='settled',tokens=${details.inputTokens + details.outputTokens},
      reserved_toman=case when reserved_toman is null then null else greatest(reserved_toman, coalesce(${details.estimatedCostToman ?? null}::bigint,0)) end
    from guard where id=${id}::uuid and state='held' returning user_id,used_platform_key
  ) insert into usage_records(user_id,project_id,provider,model,purpose,input_tokens,output_tokens,used_platform_key,
      reservation_id,run_id,agent_role,gateway,estimated_cost_toman,tariff_snapshot)
    select user_id,${details.projectId ?? null}::uuid,${details.provider},${details.model},${details.purpose},
      ${details.inputTokens},${details.outputTokens},used_platform_key,${id}::uuid,${details.runId ?? null}::uuid,
      ${details.role ?? null},${details.gateway ?? null},${details.estimatedCostToman ?? null},
      ${details.tariffSnapshot ? JSON.stringify(details.tariffSnapshot) : null}::jsonb from settled returning id`);
}
export async function releaseUsage(id: string) {
  await queryRows(
    sql`update usage_reservations set state='released' where id=${id}::uuid and state='held' returning id`,
  );
}
