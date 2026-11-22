export function selectEnvironment(raw: string): Record<string, string>;
export function summarizeEnvironment(env: Record<string, string | undefined>): {
  database: string;
  canonicalUrlMatches: boolean;
  arvanSelected: boolean;
  gatewayKeyPresent: boolean;
  budgetConfigPresent: boolean;
  arvanPriceOverridePresent: boolean;
  pricingAdminConfigured: boolean;
};
