import { and, count, eq, gte } from "drizzle-orm";
import type { z } from "zod";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import { getIntegration } from "../integrations/store";
import { extractJsonObject } from "./json";
import { providerClients } from "./providers";
import { AI_PROVIDERS, AI_PROVIDER_LABELS, type AiProviderId } from "./types";

export { AI_PROVIDERS, AI_PROVIDER_LABELS, type AiProviderId };

const platformKeys: Record<AiProviderId, () => string | undefined> = {
  openai: env.openaiKey,
  anthropic: env.anthropicKey,
  gemini: env.geminiKey,
};

const defaultModels: Record<AiProviderId, () => string> = {
  openai: env.openaiModel,
  anthropic: env.anthropicModel,
  gemini: env.geminiModel,
};

export function isAiProvider(value: string): value is AiProviderId {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

interface ResolvedKey {
  apiKey: string;
  usedPlatformKey: boolean;
  model: string;
}

/** A user's own key always wins; otherwise the platform key (with quota) is used. */
async function resolveKey(userId: string, provider: AiProviderId): Promise<ResolvedKey> {
  const own = await getIntegration(userId, provider);
  if (own) {
    return { apiKey: own.secret, usedPlatformKey: false, model: own.metadata.model || defaultModels[provider]() };
  }
  const platformKey = platformKeys[provider]();
  if (!platformKey) {
    throw new HttpError(
      400,
      `کلید ${AI_PROVIDER_LABELS[provider]} روی پلتفرم تنظیم نشده است. در صفحه تنظیمات کلید شخصی خود را وارد کنید.`,
    );
  }
  return { apiKey: platformKey, usedPlatformKey: true, model: defaultModels[provider]() };
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function platformUsageToday(userId: string): Promise<number> {
  const [row] = await db()
    .select({ value: count() })
    .from(schema.usageRecords)
    .where(
      and(
        eq(schema.usageRecords.userId, userId),
        eq(schema.usageRecords.usedPlatformKey, true),
        gte(schema.usageRecords.createdAt, startOfTodayUtc()),
      ),
    );
  return row?.value ?? 0;
}

async function assertQuota(userId: string) {
  const limit = env.aiDailyRequestLimit();
  if ((await platformUsageToday(userId)) >= limit) {
    throw new HttpError(
      429,
      `سهمیه روزانه استفاده از کلید مرکزی (${limit} درخواست) تمام شده است. فردا دوباره تلاش کنید یا کلید شخصی وارد کنید.`,
    );
  }
}

/** Lists providers with where their key would come from, for the UI. */
export async function providerAvailability(userId: string) {
  return Promise.all(
    AI_PROVIDERS.map(async (id) => {
      const own = await getIntegration(userId, id);
      const source: "user" | "platform" | null = own ? "user" : platformKeys[id]() ? "platform" : null;
      return {
        id,
        label: AI_PROVIDER_LABELS[id],
        model: own?.metadata.model || defaultModels[id](),
        available: source !== null,
        source,
      };
    }),
  );
}

export interface StructuredCallOptions<T> {
  userId: string;
  projectId?: string;
  provider: AiProviderId;
  purpose: "spec" | "code" | "fix";
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxOutputTokens: number;
}

/**
 * Runs one model call that must return JSON matching `schema`, enforcing the
 * platform quota and recording token usage for cost control.
 */
export async function generateStructured<T>(options: StructuredCallOptions<T>): Promise<{ data: T; model: string }> {
  const key = await resolveKey(options.userId, options.provider);
  if (key.usedPlatformKey) await assertQuota(options.userId);

  const result = await providerClients[options.provider]({
    apiKey: key.apiKey,
    model: key.model,
    system: options.system,
    prompt: options.prompt,
    maxOutputTokens: options.maxOutputTokens,
  });

  await db().insert(schema.usageRecords).values({
    userId: options.userId,
    projectId: options.projectId,
    provider: options.provider,
    model: result.model,
    purpose: options.purpose,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    usedPlatformKey: key.usedPlatformKey,
  });

  const parsed = options.schema.safeParse(extractJsonObject(result.text));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new HttpError(502, `خروجی مدل با ساختار مورد انتظار مطابقت نداشت (${issues}). دوباره تلاش کنید.`);
  }
  return { data: parsed.data, model: result.model };
}
