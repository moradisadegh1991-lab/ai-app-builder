import snapshot from "./arvan-price-snapshot.json";

/** Display names from the public price list are not API model identifiers. */
export const arvanReference = snapshot;
export const arvanRoleRecommendations = [
  { role: "معمار محصول", model: "Gemini 2.5 Pro" },
  { role: "طراح UI/UX", model: "Gemini 2.5 Flash" },
  { role: "توسعه‌دهنده رابط کاربری", model: "Kimi K2.7 Code" },
  { role: "توسعه‌دهنده سرور", model: "Kimi K2.7 Code" },
  { role: "ارزیاب کیفیت", model: "Gemini 2.5 Pro" },
  { role: "متخصص رفع خطا", model: "Kimi K2.7 Code" },
] as const;

/** Public-list example only: no rounding per token and no external API call. */
export function estimateReferencePrice(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = snapshot.models.find(entry => entry.name === model);
  if (!price || !Number.isSafeInteger(inputTokens) || inputTokens < 0 || !Number.isSafeInteger(outputTokens) || outputTokens < 0) return null;
  const amount = Math.ceil((inputTokens * price.inputTomanPerMillion + outputTokens * price.outputTomanPerMillion) / 1_000_000);
  return Number.isSafeInteger(amount) ? amount : null;
}
