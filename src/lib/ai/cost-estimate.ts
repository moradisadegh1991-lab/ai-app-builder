/** A dated, administrator-confirmed tariff. A quote is not an invoice. */
export interface TomanTariff {
  inputTomanPerMillion: number;
  outputTomanPerMillion: number;
  updatedAt: string;
}

/**
 * Returns a conservative whole-toman quote, or null if any part is unknown.
 * This is an estimate, not a provider charge or an invoice reconciliation.
 */
export function estimateToman(
  tariff: TomanTariff | null,
  inputTokens: number,
  outputTokens: number,
  now = Date.now(),
  maxAgeMs = 30 * 24 * 60 * 60 * 1000,
): number | null {
  if (!tariff || !Number.isSafeInteger(inputTokens) || inputTokens < 0 ||
      !Number.isSafeInteger(outputTokens) || outputTokens < 0 ||
      !Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return null;
  const date = Date.parse(tariff.updatedAt);
  if (!Number.isFinite(date) || date > now || now - date > maxAgeMs ||
      !Number.isFinite(tariff.inputTomanPerMillion) || tariff.inputTomanPerMillion <= 0 ||
      !Number.isFinite(tariff.outputTomanPerMillion) || tariff.outputTomanPerMillion <= 0) return null;
  const cost = Math.ceil((inputTokens * tariff.inputTomanPerMillion + outputTokens * tariff.outputTomanPerMillion) / 1_000_000);
  return Number.isSafeInteger(cost) ? cost : null;
}
