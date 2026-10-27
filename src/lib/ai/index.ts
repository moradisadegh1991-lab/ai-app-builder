import type { z } from "zod";
import { activePlan, usageSummary } from "../billing/subscription";
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

// Free-plan users get the providers' smaller, cheaper models on central keys.
const economyModels: Record<AiProviderId, () => string> = {
  openai: env.openaiEconomyModel,
  anthropic: env.anthropicEconomyModel,
  gemini: env.geminiEconomyModel,
};

export function isAiProvider(value: string): value is AiProviderId {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

interface ResolvedKey {
  apiKey: string;
  usedPlatformKey: boolean;
  model: string;
}

/** A user's own key always wins; otherwise the platform key, within the plan's limits. */
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
  const { plan } = await activePlan(userId);
  const model = plan.modelTier === "economy" ? economyModels[provider]() : defaultModels[provider]();
  return { apiKey: platformKey, usedPlatformKey: true, model };
}

function formatReset(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return ` (آزاد شدن: ${date.toLocaleString("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short" })})`;
}

/** Blocks a call when the 5-hour or weekly token window of the plan is used up. */
async function assertWithinPlan(userId: string) {
  const usage = await usageSummary(userId);
  const hint = "برای سقف بیشتر طرح را ارتقا دهید یا کلید API شخصی وارد کنید.";
  if (usage.window.used >= usage.window.limit) {
    throw new HttpError(
      429,
      `سقف مصرف ۵ ساعته طرح «${usage.plan.name}» پر شده است${formatReset(usage.window.resetsAt)}. ${hint}`,
    );
  }
  if (usage.week.used >= usage.week.limit) {
    throw new HttpError(
      429,
      `سقف مصرف هفتگی طرح «${usage.plan.name}» پر شده است${formatReset(usage.week.resetsAt)}. ${hint}`,
    );
  }
}

/** Lists providers with where their key would come from, for the UI. */
export async function providerAvailability(userId: string) {
  const { plan } = await activePlan(userId);
  return Promise.all(
    AI_PROVIDERS.map(async (id) => {
      const own = await getIntegration(userId, id);
      const source: "user" | "platform" | null = own ? "user" : platformKeys[id]() ? "platform" : null;
      const platformModel = plan.modelTier === "economy" ? economyModels[id]() : defaultModels[id]();
      return {
        id,
        label: AI_PROVIDER_LABELS[id],
        model: own ? own.metadata.model || defaultModels[id]() : platformModel,
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
 * plan's usage windows and recording token usage for cost control.
 */
export async function generateStructured<T>(options: StructuredCallOptions<T>): Promise<{ data: T; model: string }> {
  const key = await resolveKey(options.userId, options.provider);
  if (key.usedPlatformKey) await assertWithinPlan(options.userId);

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
