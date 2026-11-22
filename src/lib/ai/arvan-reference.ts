import snapshot from "./arvan-price-snapshot.json";
import type { AgentRole } from "../agents/contracts";

/** Display names from the public price list are not API model identifiers. */
export const arvanReference = snapshot;
// IDs verified by the account owner in the Arvan gateway. Availability and
// output quality must still be checked in the target environment.
export const arvanDefaultModels: Record<AgentRole, string> = {
  architect: "Gemini-2.5-Pro", designer: "Gemini-2.5-Pro",
  frontend: "Kimi-K2.6", backend: "Kimi-K2.6",
  reviewer: "Gemini-2.5-Pro", debugger: "Kimi-K2.6",
};
export const arvanDefaultModel = "Gemini-2.5-Pro";

/** Only exact, verified IDs have snapshot prices. Unknown IDs must fail closed. */
export function arvanReferenceRate(model: string) {
  const name = model === "Gemini-2.5-Pro" ? "Gemini 2.5 Pro" : model === "Kimi-K2.6" ? "Kimi K2.6" : null;
  const price = snapshot.models.find(entry => entry.name === name);
  return price ? { inputTomanPerMillion: price.inputTomanPerMillion, outputTomanPerMillion: price.outputTomanPerMillion, updatedAt: `${snapshot.retrievedAt}T00:00:00Z`, source: "public-reference" as const } : null;
}

export const arvanRoleRecommendations = [
  { role: "معمار محصول", model: "Gemini 2.5 Pro" },
  { role: "طراح UI/UX", model: "Gemini 2.5 Pro" },
  { role: "توسعه‌دهنده رابط کاربری", model: "Kimi K2.6" },
  { role: "توسعه‌دهنده سرور", model: "Kimi K2.6" },
  { role: "ارزیاب کیفیت", model: "Gemini 2.5 Pro" },
  { role: "متخصص رفع خطا", model: "Kimi K2.6" },
] as const;

/** Public-list example only: no rounding per token and no external API call. */
export function estimateReferencePrice(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = snapshot.models.find(entry => entry.name === model);
  if (!price || !Number.isSafeInteger(inputTokens) || inputTokens < 0 || !Number.isSafeInteger(outputTokens) || outputTokens < 0) return null;
  const amount = Math.ceil((inputTokens * price.inputTomanPerMillion + outputTokens * price.outputTomanPerMillion) / 1_000_000);
  return Number.isSafeInteger(amount) ? amount : null;
}
