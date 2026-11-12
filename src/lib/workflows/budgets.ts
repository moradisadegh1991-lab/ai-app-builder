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
export async function reserveUsage(userId: string, runId: string | undefined, tokens: number, platform: boolean) {
  const id = randomUUID();
  const { plan } = await activePlan(userId);
  const rows = await queryRows<{
    allowed: boolean;
  }>(sql`select reserve_ai_usage(${id}::uuid,${userId}::uuid,${runId ?? null}::uuid,
    ${tokens},${platform},${plan.windowTokens}::bigint,${plan.weeklyTokens}::bigint) as allowed`);
  if (!rows[0]?.allowed)
    throw new HttpError(
      429,
      "بودجهٔ باقی‌مانده برای این مرحله کافی نیست؛ پس از آزادشدن سهمیه یا افزایش بودجه دوباره تلاش کنید.",
    );
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
  },
) {
  // A single statement prevents a retry from recording usage twice.
  await queryRows(sql`with settled as (
    update usage_reservations set state='settled',tokens=${details.inputTokens + details.outputTokens}
    where id=${id}::uuid and state='held' returning user_id,used_platform_key
  ) insert into usage_records(user_id,project_id,provider,model,purpose,input_tokens,output_tokens,used_platform_key)
    select user_id,${details.projectId ?? null}::uuid,${details.provider},${details.model},${details.purpose},
      ${details.inputTokens},${details.outputTokens},used_platform_key from settled returning id`);
}
export async function releaseUsage(id: string) {
  await queryRows(
    sql`update usage_reservations set state='released' where id=${id}::uuid and state='held' returning id`,
  );
}
