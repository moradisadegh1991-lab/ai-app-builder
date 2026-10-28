import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "../db";
import type { PlanId } from "../db/schema";
import { env } from "../env";
import { DEVELOPER_PLAN, PERIOD_DAYS, PLANS, WINDOW_HOURS, type Plan } from "./plans";

export interface ActivePlan {
  plan: Plan;
  currentPeriodEnd: Date | null;
}

async function isUnlimitedUser(userId: string) {
  const emails = env.unlimitedEmails();
  if (emails.length === 0) return false;
  const [user] = await db().select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return Boolean(user && emails.includes(user.email.toLowerCase()));
}

export async function activePlan(userId: string): Promise<ActivePlan> {
  if (await isUnlimitedUser(userId)) return { plan: DEVELOPER_PLAN, currentPeriodEnd: null };
  const [sub] = await db()
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);
  if (!sub || sub.currentPeriodEnd < new Date()) return { plan: PLANS.free, currentPeriodEnd: null };
  return { plan: PLANS[sub.plan], currentPeriodEnd: sub.currentPeriodEnd };
}

/**
 * Activates a paid plan for one period. Buying the same plan again extends it;
 * switching plans starts a fresh period from now.
 */
export async function grantPlan(userId: string, plan: PlanId) {
  const [sub] = await db()
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);
  const now = Date.now();
  const base = sub && sub.plan === plan && sub.currentPeriodEnd.getTime() > now ? sub.currentPeriodEnd.getTime() : now;
  const currentPeriodEnd = new Date(base + PERIOD_DAYS * 24 * 60 * 60_000);
  await db()
    .insert(schema.subscriptions)
    .values({ userId, plan, currentPeriodEnd })
    .onConflictDoUpdate({
      target: schema.subscriptions.userId,
      set: { plan, currentPeriodEnd, updatedAt: new Date() },
    });
  return currentPeriodEnd;
}

async function tokensSince(userId: string, since: Date) {
  const [row] = await db()
    .select({ total: sql<number>`coalesce(sum(${schema.usageRecords.inputTokens} + ${schema.usageRecords.outputTokens}), 0)::int` })
    .from(schema.usageRecords)
    .where(
      and(
        eq(schema.usageRecords.userId, userId),
        eq(schema.usageRecords.usedPlatformKey, true),
        gte(schema.usageRecords.createdAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}

async function oldestSince(userId: string, since: Date) {
  const [row] = await db()
    .select({ first: sql<Date | null>`min(${schema.usageRecords.createdAt})` })
    .from(schema.usageRecords)
    .where(
      and(
        eq(schema.usageRecords.userId, userId),
        eq(schema.usageRecords.usedPlatformKey, true),
        gte(schema.usageRecords.createdAt, since),
      ),
    );
  return row?.first ? new Date(row.first) : null;
}

export interface UsageSummary {
  plan: Plan;
  currentPeriodEnd: string | null;
  window: { used: number; limit: number; resetsAt: string | null };
  week: { used: number; limit: number; resetsAt: string | null };
}

/** Usage in the rolling windows; a window "resets" when its oldest usage ages out. */
export async function usageSummary(userId: string): Promise<UsageSummary> {
  const { plan, currentPeriodEnd } = await activePlan(userId);
  const windowMs = WINDOW_HOURS * 60 * 60_000;
  const weekMs = 7 * 24 * 60 * 60_000;
  const windowStart = new Date(Date.now() - windowMs);
  const weekStart = new Date(Date.now() - weekMs);
  const [windowUsed, weekUsed, windowFirst, weekFirst] = await Promise.all([
    tokensSince(userId, windowStart),
    tokensSince(userId, weekStart),
    oldestSince(userId, windowStart),
    oldestSince(userId, weekStart),
  ]);
  return {
    plan,
    currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
    window: {
      used: windowUsed,
      limit: plan.windowTokens,
      resetsAt: windowFirst ? new Date(windowFirst.getTime() + windowMs).toISOString() : null,
    },
    week: {
      used: weekUsed,
      limit: plan.weeklyTokens,
      resetsAt: weekFirst ? new Date(weekFirst.getTime() + weekMs).toISOString() : null,
    },
  };
}
