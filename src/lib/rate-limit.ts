import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { env } from "./env";
import { HttpError } from "./http";

// Fixed-window counters kept in the platform database, so limits hold across serverless
// instances. One statement per check. If the counter cannot be read (e.g. migration 0005 is not
// applied yet) the request is allowed: rate limiting must never take the site down.

/** Client address as a salted hash (the raw IP is never stored). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip") ?? forwarded ?? "unknown";
  return createHash("sha256").update(`${env.sessionSecret()}:${ip}`).digest("hex").slice(0, 24);
}

function wait(seconds: number) {
  if (seconds < 90) return `${Math.max(1, Math.ceil(seconds)).toLocaleString("fa-IR")} ثانیه`;
  if (seconds < 5400) return `${Math.ceil(seconds / 60).toLocaleString("fa-IR")} دقیقه`;
  return `${Math.ceil(seconds / 3600).toLocaleString("fa-IR")} ساعت`;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  /** Seconds until the current window ends. */
  retryAfter: number;
}

/** Counts one hit for `scope:id`; `allowed` is false once more than `limit` hits fall in the window. */
export async function hit(scope: string, id: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const key = `${scope}:${id}`;
  const result = await db().execute(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count, extract(epoch from (window_start + make_interval(secs => ${windowSeconds}) - now())) as retry_after`);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { count: number; retry_after: string | number }[];
  const count = Number(rows[0]?.count ?? 1);
  return { allowed: count <= limit, count, retryAfter: Math.max(0, Number(rows[0]?.retry_after ?? windowSeconds)) };
}

/** Throws 429 when the caller is over the limit. */
export async function enforce(scope: string, id: string, limit: number, windowSeconds: number, what = "درخواست") {
  let result: RateLimitResult;
  try {
    result = await hit(scope, id, limit, windowSeconds);
  } catch (error) {
    console.error("rate limit check failed (allowing the request)", error);
    return;
  }
  // Housekeeping: about one request in a hundred clears counters whose window is long over.
  if (Math.random() < 0.01) void sweepExpired().catch(() => undefined);
  if (!result.allowed) {
    throw new HttpError(429, `تعداد ${what} بیش از حد مجاز است؛ ${wait(result.retryAfter)} دیگر دوباره تلاش کنید.`);
  }
}

/** Deletes counters whose window is long over; called now and then, never on the hot path of a single request. */
export async function sweepExpired() {
  await db().execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
}
