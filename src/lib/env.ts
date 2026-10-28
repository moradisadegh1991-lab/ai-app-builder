// Server-side environment access. Values are read lazily so that `next build`
// does not fail when secrets are only available at runtime.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value ? value : undefined;
}

export const env = {
  databaseUrl: () => required("DATABASE_URL"),
  // OAuth, payment and agent URLs are built from this, so a wrong value (e.g. the
  // localhost default in production) breaks sign-in with redirect_uri_mismatch.
  appUrl: () => {
    const url = optional("APP_URL");
    if (!url) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("APP_URL is not set. Set it to the public address of this site, e.g. https://idea2app.vercel.app");
      }
      return "http://localhost:3000";
    }
    return url.replace(/\/+$/, "");
  },
  encryptionKey: () => required("ENCRYPTION_KEY"),
  sessionSecret: () => required("SESSION_SECRET"),
  githubClientId: () => required("GITHUB_CLIENT_ID"),
  githubClientSecret: () => required("GITHUB_CLIENT_SECRET"),
  githubConfigured: () => Boolean(optional("GITHUB_CLIENT_ID") && optional("GITHUB_CLIENT_SECRET")),
  // Google sign-in is optional; the button only appears when both are set.
  googleClientId: () => optional("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => optional("GOOGLE_CLIENT_SECRET"),
  // Optional OpenAI-compatible gateway (e.g. Liara AI) that serves all three providers with one key.
  aiGatewayBaseUrl: () => optional("AI_GATEWAY_BASE_URL")?.replace(/\/+$/, ""),
  aiGatewayKey: () => optional("AI_GATEWAY_API_KEY"),
  openaiKey: () => optional("OPENAI_API_KEY"),
  anthropicKey: () => optional("ANTHROPIC_API_KEY"),
  geminiKey: () => optional("GEMINI_API_KEY"),
  openaiModel: () => optional("OPENAI_MODEL") ?? "gpt-5",
  anthropicModel: () => optional("ANTHROPIC_MODEL") ?? "claude-opus-5-5",
  geminiModel: () => optional("GEMINI_MODEL") ?? "gemini-2.5-pro",
  // E-mail: Resend is used when its key is set, otherwise SMTP.
  mailFrom: () => optional("MAIL_FROM") ?? "Idea2App AI <no-reply@example.com>",
  resendApiKey: () => optional("RESEND_API_KEY"),
  smtpHost: () => optional("SMTP_HOST"),
  smtpPort: () => Number(optional("SMTP_PORT") ?? "587"),
  smtpUser: () => optional("SMTP_USER"),
  smtpPass: () => optional("SMTP_PASS"),
  // Payments
  zarinpalMerchantId: () => optional("ZARINPAL_MERCHANT_ID"),
  zarinpalSandbox: () => optional("ZARINPAL_SANDBOX") === "1",
  usdToToman: () => Number(optional("USD_TO_TOMAN") ?? "0"),
  stripeSecretKey: () => optional("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => optional("STRIPE_WEBHOOK_SECRET"),
  // Economy models for the free plan (cheaper per token).
  openaiEconomyModel: () => optional("OPENAI_ECONOMY_MODEL") ?? "gpt-5-mini",
  anthropicEconomyModel: () => optional("ANTHROPIC_ECONOMY_MODEL") ?? "claude-haiku-5-5",
  geminiEconomyModel: () => optional("GEMINI_ECONOMY_MODEL") ?? "gemini-2.5-flash",
  neonApiKey: () => optional("NEON_API_KEY"),
  neonOrgId: () => optional("NEON_ORG_ID"),
  isProduction: () => process.env.NODE_ENV === "production",
};
