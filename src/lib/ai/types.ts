export const AI_PROVIDERS = ["openai", "anthropic", "gemini"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
};

export interface CompletionRequest {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}
