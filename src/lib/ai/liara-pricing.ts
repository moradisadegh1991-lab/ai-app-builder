import { z } from "zod";

const priceSchema = z.object({
  inputTomanPerMillion: z.number().finite().min(0).max(1e12),
  outputTomanPerMillion: z.number().finite().min(0).max(1e12),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export type LiaraPrice = z.infer<typeof priceSchema>;
export type DisplayPrice = { inputPerMillion: number; outputPerMillion: number; currency: "USD" | "IRT"; updatedAt: string; source: "liara-catalog" | "administrator" };

export function isLiaraGateway(gateway: string | undefined, source: string | null): boolean {
  if (!gateway || source !== "platform") return false;
  try {
    const url = new URL(gateway);
    return url.protocol === "https:" && url.hostname === "ai.liara.ir" && !url.username && !url.password;
  } catch { return false; }
}

/** Only admin-configured prices for the exact model on Liara's platform gateway. */
export function liaraModelPrice(raw: string | undefined, gateway: string | undefined, source: string | null, model: string): LiaraPrice | null {
  if (!raw || !isLiaraGateway(gateway, source)) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data) || !Object.hasOwn(data, model)) return null;
    const result = priceSchema.safeParse((data as Record<string, unknown>)[model]);
    if (!result.success || Date.parse(result.data.updatedAt) > Date.now()) return null;
    return result.data;
  } catch {
    return null;
  }
}

// Public catalog used by Liara's own console; it is not an account-specific quote.
// Cache within each server instance and fail closed if the undocumented endpoint changes.
let catalog: { prices: Map<string, DisplayPrice>; expires: number } | undefined;
let pending: Promise<Map<string, DisplayPrice> | null> | undefined;
export async function liaraCatalogPrice(model: string): Promise<DisplayPrice | null> {
  if (catalog && catalog.expires > Date.now()) return catalog.prices.get(model) ?? null;
  if (!pending) pending = (async () => {
    try {
      const response = await fetch("https://ai.liara.ir/v1/models", { signal: AbortSignal.timeout(6000), cache: "no-store" });
      if (!response.ok) return null;
      const text = await response.text();
      if (text.length > 2_000_000) return null;
      const result: unknown = JSON.parse(text);
      const parsed = z.object({ models: z.array(z.unknown()).max(3000) }).safeParse(result);
      if (!parsed.success) return null;
      const prices = new Map<string, DisplayPrice>();
      const updatedAt = new Date().toISOString();
      const itemSchema = z.object({ id: z.string().min(1).max(200), pricing: z.object({ prompt: z.string(), completion: z.string() }).passthrough(), architecture: z.object({ output_modalities: z.array(z.string()).optional() }).passthrough().optional() }).passthrough();
      for (const entry of parsed.data.models) {
        const itemResult = itemSchema.safeParse(entry);
        if (!itemResult.success) continue;
        const item = itemResult.data;
        if (item.architecture?.output_modalities && !item.architecture.output_modalities.includes("text")) continue;
        // Some models are priced per image, second or request; text-token rates
        // are not a reliable estimate for those entries.
        if (typeof item.pricing.special_price === "string" && item.pricing.special_price.trim()) continue;
        const input = Number(item.pricing.prompt), output = Number(item.pricing.completion);
        if (!item.pricing.prompt.trim() || !item.pricing.completion.trim() || !Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0 || input > 1 || output > 1) continue;
        prices.set(item.id, { inputPerMillion: input * 1e6, outputPerMillion: output * 1e6, currency: "USD", updatedAt, source: "liara-catalog" });
      }
      catalog = { prices, expires: Date.now() + 30 * 60 * 1000 };
      return prices;
    } catch { return null; }
  })().finally(() => { pending = undefined; });
  return (await pending)?.get(model) ?? null;
}
