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
  appUrl: () => (optional("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, ""),
  encryptionKey: () => required("ENCRYPTION_KEY"),
  sessionSecret: () => required("SESSION_SECRET"),
  githubClientId: () => required("GITHUB_CLIENT_ID"),
  githubClientSecret: () => required("GITHUB_CLIENT_SECRET"),
  openaiKey: () => optional("OPENAI_API_KEY"),
  anthropicKey: () => optional("ANTHROPIC_API_KEY"),
  geminiKey: () => optional("GEMINI_API_KEY"),
  openaiModel: () => optional("OPENAI_MODEL") ?? "gpt-5",
  anthropicModel: () => optional("ANTHROPIC_MODEL") ?? "claude-opus-5-5",
  geminiModel: () => optional("GEMINI_MODEL") ?? "gemini-2.5-pro",
  aiDailyRequestLimit: () => Number(optional("AI_DAILY_REQUEST_LIMIT") ?? "20"),
  neonApiKey: () => optional("NEON_API_KEY"),
  neonOrgId: () => optional("NEON_ORG_ID"),
  isProduction: () => process.env.NODE_ENV === "production",
};
