import { afterEach, describe, expect, it, vi } from "vitest";
import { callProvider } from "../src/lib/ai/providers";

const request = {
  apiKey: "gateway-key",
  gatewayBaseUrl: "https://ai.example.test/api/abc/v1",
  model: "google/gemini-3.7-flash",
  system: "Return JSON.",
  prompt: "Make a todo app",
  maxOutputTokens: 1000,
};

const ok = (content: string, finish = "stop") =>
  new Response(
    JSON.stringify({
      model: "google/gemini-3.7-flash",
      choices: [{ message: { content }, finish_reason: finish }],
      usage: { prompt_tokens: 12, completion_tokens: 34 },
    }),
  );

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI-compatible gateway", () => {
  it("posts to {base}/chat/completions with the gateway key and reads usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok('{"a":1}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callProvider("gemini", request);

    expect(fetchMock.mock.calls[0]![0]).toBe("https://ai.example.test/api/abc/v1/chat/completions");
    const init = fetchMock.mock.calls[0]![1];
    expect(init.headers.authorization).toBe("Bearer gateway-key");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "google/gemini-3.7-flash", max_tokens: 1000, response_format: { type: "json_object" } });
    expect(result).toEqual({ text: '{"a":1}', model: "google/gemini-3.7-flash", inputTokens: 12, outputTokens: 34 });
  });

  it("retries once without JSON mode when the gateway answers 400", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("response_format is not supported", { status: 400 }))
      .mockResolvedValueOnce(ok('{"a":2}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callProvider("anthropic", request);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).not.toHaveProperty("response_format");
    expect(result.text).toBe('{"a":2}');
  });

  it("does not retry other errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad key", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callProvider("openai", request)).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a truncated answer instead of returning partial JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok('{"a":', "length")));
    await expect(callProvider("openai", request)).rejects.toThrow(/سقف توکن/);
  });
});
