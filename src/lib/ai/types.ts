export const AI_PROVIDERS = ["openai", "anthropic", "gemini"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
};

export interface CompletionImage {
  mime: string;
  /** Base64, without a data: prefix. */
  data: string;
}

export interface CompletionRequest {
  apiKey: string;
  /** Set to route the call through an OpenAI-compatible gateway instead of the provider's own API. */
  gatewayBaseUrl?: string;
  model: string;
  system: string;
  prompt: string;
  images?: CompletionImage[];
  maxOutputTokens: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}
