import Anthropic from "@anthropic-ai/sdk";
import type { AiProviderId, CompletionRequest, CompletionResult } from "./types";

// User message for OpenAI-style APIs: plain text, or text plus images as data URLs.
function openAiUserContent(req: CompletionRequest) {
  if (!req.images?.length) return req.prompt;
  return [
    { type: "text", text: req.prompt },
    ...req.images.map((image) => ({ type: "image_url", image_url: { url: `data:${image.mime};base64,${image.data}` } })),
  ];
}

// One client per provider behind a common interface; all are asked for JSON
// output. Claude goes through the official SDK (streaming); OpenAI and Gemini
// use their REST APIs directly.

const REQUEST_TIMEOUT_MS = 280_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AI provider error ${response.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

async function callOpenAI(req: CompletionRequest): Promise<CompletionResult> {
  const data = await postJson(
    "https://api.openai.com/v1/chat/completions",
    { authorization: `Bearer ${req.apiKey}` },
    {
      model: req.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: openAiUserContent(req) },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: req.maxOutputTokens,
    },
  );
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? req.model,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

async function callAnthropic(req: CompletionRequest): Promise<CompletionResult> {
  const client = new Anthropic({ apiKey: req.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  const useFallbacks = FALLBACK_MODELS.has(req.model);
  // Streaming avoids HTTP timeouts on large code-generation outputs.
  const message = await client.beta.messages
    .stream({
      model: req.model,
      max_tokens: req.maxOutputTokens,
      system: req.system,
      messages: [
        {
          role: "user",
          content: req.images?.length
            ? [
                ...req.images.map((image) => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: image.mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
                    data: image.data,
                  },
                })),
                { type: "text" as const, text: req.prompt },
              ]
            : req.prompt,
        },
      ],
      output_config: { effort: "high" },
      ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    })
    .finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("Claude این درخواست را رد کرد؛ ایده را بازنویسی کنید یا مدل دیگری انتخاب کنید.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("پاسخ Claude به سقف توکن رسید و ناقص است؛ ایده را ساده‌تر کنید یا دوباره تلاش کنید.");
  }
  const text = message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  return {
    text,
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

async function callGemini(req: CompletionRequest): Promise<CompletionResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
  const data = await postJson(
    url,
    { "x-goog-api-key": req.apiKey },
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: req.prompt },
            ...(req.images ?? []).map((image) => ({ inlineData: { mimeType: image.mime, data: image.data } })),
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: req.maxOutputTokens },
    },
  );
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("پاسخ Gemini به سقف توکن رسید و ناقص است؛ دوباره تلاش کنید.");
  }
  const text = (candidate?.content?.parts ?? []).map((part: { text?: string }) => part.text ?? "").join("");
  return {
    text,
    model: req.model,
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// OpenAI-compatible gateways (Liara AI, OpenRouter, ...) expose Claude, Gemini and OpenAI models
// behind /chat/completions. They vary in what they accept, so use the most widely supported
// parameters and retry once without JSON mode if the gateway rejects it (the JSON is parsed
// out of plain text anyway).
async function callGateway(req: CompletionRequest): Promise<CompletionResult> {
  const url = `${req.gatewayBaseUrl}/chat/completions`;
  const body = {
    model: req.model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: openAiUserContent(req) },
    ],
    max_tokens: req.maxOutputTokens,
  };
  const headers = { authorization: `Bearer ${req.apiKey}` };
  let data: any;
  try {
    data = await postJson(url, headers, { ...body, response_format: { type: "json_object" } });
  } catch (error) {
    if (!(error instanceof Error) || !/ 400:/.test(error.message)) throw error;
    data = await postJson(url, headers, body);
  }
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new Error("پاسخ مدل به سقف توکن رسید و ناقص است؛ ایده را ساده‌تر کنید یا دوباره تلاش کنید.");
  }
  return {
    text: choice?.message?.content ?? "",
    model: data.model ?? req.model,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

export async function callProvider(provider: AiProviderId, req: CompletionRequest): Promise<CompletionResult> {
  return req.gatewayBaseUrl ? callGateway(req) : providerClients[provider](req);
}

export const providerClients: Record<AiProviderId, (req: CompletionRequest) => Promise<CompletionResult>> = {
  openai: callOpenAI,
  anthropic: callAnthropic,
  gemini: callGemini,
};
