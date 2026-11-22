import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { generateStructured } from "../src/lib/ai";
import { CompletionTruncatedError } from "../src/lib/ai/errors";
const h = vi.hoisted(() => ({
  call: vi.fn(),
  reserve: vi.fn(),
  settle: vi.fn(),
  release: vi.fn(),
  own: vi.fn(),
}));
vi.mock("../src/lib/ai/admin-pricing", async () => {
  const { liaraModelPrice } = await import("../src/lib/ai/liara-pricing");
  return { configuredLiaraPrice: async (gateway: string | undefined, source: string | null, model: string) => { const p = liaraModelPrice(process.env.LIARA_MODEL_PRICING_JSON, gateway, source, model); return p ? { ...p, source: "environment-estimate" as const } : null; } };
});
vi.mock("../src/lib/ai/providers", () => ({ callProvider: h.call }));
vi.mock("../src/lib/integrations/store", () => ({
  getIntegration: h.own,
}));
vi.mock("../src/lib/rate-limit", () => ({ enforce: async () => undefined }));
vi.mock("../src/lib/billing/subscription", () => ({
  activePlan: async () => ({ plan: { modelTier: "economy" } }),
  usageSummary: async () => ({
    plan: { name: "Free" },
    window: { used: 0, limit: 100000 },
    week: { used: 0, limit: 300000 },
  }),
}));
vi.mock("../src/lib/workflows/budgets", () => ({
  reserveUsage: h.reserve,
  settleUsage: h.settle,
  releaseUsage: h.release,
  tokenReservation: () => 1000,
}));
const options = {
  userId: "user",
  provider: "openai" as const,
  purpose: "spec" as const,
  system: "Return JSON",
  prompt: "Task",
  schema: z.object({ ok: z.boolean() }),
  maxOutputTokens: 100,
};
beforeEach(() => {
  vi.resetAllMocks();
  h.own.mockResolvedValue(null);
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  vi.stubEnv("AI_GATEWAY_BASE_URL", "https://ai.liara.ir/v1");
  vi.stubEnv("OPENAI_ECONOMY_MODEL", "test");
  vi.stubEnv("LIARA_MODEL_PRICING_JSON", JSON.stringify(Object.fromEntries(["openai/test", "openai/economy-model"].map(model => [model, { inputTomanPerMillion: 100000, outputTomanPerMillion: 500000, updatedAt: new Date().toISOString() }]))));
  h.reserve.mockResolvedValue("reservation");
  h.call.mockResolvedValue({
    text: '{"ok":true}',
    model: "test",
    inputTokens: 100,
    outputTokens: 20,
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("AI accounting around provider failures", () => {
  it("chooses the owner-confirmed Arvan default for each code role", async () => {
    vi.stubEnv("AI_GATEWAY_KIND", "arvan");
    vi.stubEnv("AI_GATEWAY_BASE_URL", "https://api.arvancloudai.ir/v1");
    vi.stubEnv("ARVAN_MODEL_PRICING_JSON", JSON.stringify({ "Kimi-K2.6": { inputTomanPerMillion: 304000, outputTomanPerMillion: 1280000, updatedAt: new Date().toISOString() } }));
    h.call.mockResolvedValue({ text: '{"ok":true}', model: "Kimi-K2.6", inputTokens: 100, outputTokens: 20 });
    await generateStructured({ ...options, role: "frontend" });
    expect(h.call).toHaveBeenCalledWith("openai", expect.objectContaining({ model: "Kimi-K2.6", gatewayKind: "arvan" }));
    expect(h.settle).toHaveBeenCalledWith("reservation", expect.objectContaining({ provider: "arvan", model: "Kimi-K2.6" }));
  });
  it("keeps a user's own provider key outside the Arvan gateway", async () => {
    vi.stubEnv("AI_GATEWAY_KIND", "arvan");
    vi.stubEnv("AI_GATEWAY_BASE_URL", "https://api.arvancloudai.ir/v1");
    h.own.mockResolvedValue({ secret: "personal-key", metadata: { model: "personal-model" } });
    await generateStructured({ ...options, role: "frontend" });
    expect(h.call).toHaveBeenCalledWith("openai", expect.objectContaining({ apiKey: "personal-key", model: "personal-model", gatewayBaseUrl: undefined }));
    expect(h.reserve).toHaveBeenCalledWith("user", undefined, 1000, false, undefined);
  });
  it("requires an exact configured Arvan role and tariff before reserving or calling", async () => {
    vi.stubEnv("AI_GATEWAY_KIND", "arvan");
    vi.stubEnv("AI_GATEWAY_BASE_URL", "https://ai.example.test/v1");
    vi.stubEnv("ARVAN_AGENT_FRONTEND_ECONOMY_MODEL", "Kimi-Code");
    vi.stubEnv("ARVAN_MODEL_PRICING_JSON", JSON.stringify({ "Kimi-Code": { inputTomanPerMillion: 304000, outputTomanPerMillion: 1280000, updatedAt: new Date().toISOString() } }));
    h.call.mockResolvedValue({ text: '{"ok":true}', model: "Kimi-Code", inputTokens: 100, outputTokens: 20 });
    await generateStructured({ ...options, role: "frontend" });
    expect(h.call).toHaveBeenCalledWith("openai", expect.objectContaining({ model: "Kimi-Code", gatewayKind: "arvan" }));
    expect(h.settle).toHaveBeenCalledWith("reservation", expect.objectContaining({ estimatedCostToman: 56, model: "Kimi-Code" }));
    h.call.mockClear(); h.reserve.mockClear();
    vi.stubEnv("ARVAN_MODEL_PRICING_JSON", "{}");
    await expect(generateStructured({ ...options, role: "frontend" })).rejects.toMatchObject({ status: 503 });
    expect(h.call).not.toHaveBeenCalled(); expect(h.reserve).not.toHaveBeenCalled();
    vi.stubEnv("ARVAN_MODEL_PRICING_JSON", JSON.stringify({ "Kimi-Code": { inputTomanPerMillion: 304000, outputTomanPerMillion: 1280000, updatedAt: "2020-01-01T00:00:00Z" } }));
    await expect(generateStructured({ ...options, role: "frontend" })).rejects.toMatchObject({ status: 503 });
    expect(h.call).not.toHaveBeenCalled(); expect(h.reserve).not.toHaveBeenCalled();
    await expect(generateStructured({ ...options, role: "backend" })).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("AI_GATEWAY_BASE_URL", "http://ai.example.test/v1");
    await expect(generateStructured({ ...options, role: "frontend" })).rejects.toMatchObject({ status: 503 });
  });

  const truncated = () => new CompletionTruncatedError({
    text: '{"ok":', model: "test", inputTokens: 100, outputTokens: 100,
  });
  it("meters a truncated response, retries once with more room and validates only the complete result", async () => {
    h.call.mockRejectedValueOnce(truncated());
    await expect(generateStructured(options)).resolves.toMatchObject({ data: { ok: true } });
    expect(h.call.mock.calls.map(([, request]) => request.maxOutputTokens)).toEqual([100, 200]);
    expect(h.reserve).toHaveBeenCalledTimes(2);
    expect(h.settle).toHaveBeenCalledTimes(2);
    expect(h.settle.mock.calls[0]![1]).toMatchObject({ inputTokens: 100, outputTokens: 100 });
  });
  it("stops after the bounded retry and never accepts partial output", async () => {
    h.call.mockRejectedValue(truncated());
    await expect(generateStructured(options)).rejects.toBeInstanceOf(CompletionTruncatedError);
    expect(h.call).toHaveBeenCalledTimes(2);
    expect(h.settle).toHaveBeenCalledTimes(2);
  });
  it("requires another budget admission before retrying", async () => {
    h.call.mockRejectedValueOnce(truncated());
    h.reserve.mockResolvedValueOnce("first").mockRejectedValueOnce(new Error("budget exhausted"));
    await expect(generateStructured(options)).rejects.toThrow("budget exhausted");
    expect(h.call).toHaveBeenCalledOnce();
    expect(h.settle).toHaveBeenCalledOnce();
  });
  it("retains an unmetered truncation hold while reserving the retry separately", async () => {
    h.call.mockRejectedValueOnce(new CompletionTruncatedError({ text: "", model: "test", inputTokens: 0, outputTokens: 0 }));
    await generateStructured(options);
    expect(h.reserve).toHaveBeenCalledTimes(2);
    expect(h.settle).toHaveBeenCalledOnce();
    expect(h.release).not.toHaveBeenCalled();
  });
  it("does not retry after cancellation or above the output ceiling", async () => {
    const controller = new AbortController();
    h.call.mockImplementationOnce(async () => { controller.abort(); throw truncated(); });
    await expect(generateStructured({ ...options, signal: controller.signal })).rejects.toThrow();
    expect(h.call).toHaveBeenCalledOnce();
    h.call.mockClear().mockRejectedValue(truncated());
    await expect(generateStructured({ ...options, maxOutputTokens: 32768 })).rejects.toBeInstanceOf(CompletionTruncatedError);
    expect(h.call).toHaveBeenCalledOnce();
  });
  it("reserves before inference and settles measured usage", async () => {
    await expect(generateStructured(options)).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(h.reserve.mock.invocationCallOrder[0]).toBeLessThan(h.call.mock.invocationCallOrder[0]!);
    expect(h.settle).toHaveBeenCalledWith(
      "reservation",
      expect.objectContaining({ inputTokens: 100, outputTokens: 20 }),
    );
  });
  it("retains a hold when a gateway omits its usage", async () => {
    h.call.mockResolvedValue({
      text: '{"ok":true}',
      model: "test",
      inputTokens: 0,
      outputTokens: 0,
    });
    await generateStructured(options);
    expect(h.settle).not.toHaveBeenCalled();
    expect(h.release).not.toHaveBeenCalled();
  });
  it("releases a rejected unauthorized request, but keeps an uncertain timeout reserved", async () => {
    h.call.mockRejectedValue(new Error("AI provider error 401: invalid key"));
    await expect(generateStructured(options)).rejects.toThrow("401");
    expect(h.release).toHaveBeenCalledWith("reservation");
    h.release.mockClear();
    h.call.mockRejectedValue(new Error("timeout"));
    await expect(generateStructured(options)).rejects.toThrow("timeout");
    expect(h.release).not.toHaveBeenCalled();
  });
  it("records paid inference even when the model's JSON is invalid", async () => {
    h.call.mockResolvedValue({
      text: '{"wrong":true}',
      model: "test",
      inputTokens: 100,
      outputTokens: 20,
    });
    await expect(generateStructured(options)).rejects.toMatchObject({
      status: 502,
    });
    expect(h.settle).toHaveBeenCalledOnce();
  });
  it("stores an estimate only for a current, exact Liara text tariff", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    vi.stubEnv("AI_GATEWAY_BASE_URL", "https://ai.liara.ir/v1");
    vi.stubEnv("OPENAI_ECONOMY_MODEL", "test");
    vi.stubEnv("LIARA_MODEL_PRICING_JSON", JSON.stringify({ "openai/test": {
      inputTomanPerMillion: 100000, outputTomanPerMillion: 500000, updatedAt: new Date().toISOString(),
    } }));
    h.call.mockResolvedValue({ text: '{"ok":true}', model: "openai/test", inputTokens: 100, outputTokens: 20 });
    await generateStructured({ ...options, role: "frontend" });
    expect(h.settle).toHaveBeenCalledWith("reservation", expect.objectContaining({ estimatedCostToman: 20, gateway: "ai.liara.ir", role: "frontend", tariffSnapshot: expect.objectContaining({ source: "environment-estimate" }) }));
    h.settle.mockClear();
    await expect(generateStructured({ ...options, images: [{ mime: "image/png", data: "abc" }] })).rejects.toMatchObject({ status: 503 });
    expect(h.settle).not.toHaveBeenCalled();
  });
  it("keeps free accounts on the economy role model", async () => {
    vi.stubEnv("AGENT_DESIGNER_MODEL", "expensive-model");
    vi.stubEnv("AGENT_DESIGNER_ECONOMY_MODEL", "economy-model");
    await generateStructured({ ...options, role: "designer" });
    expect(h.call).toHaveBeenCalledWith("openai", expect.objectContaining({ model: "openai/economy-model" }));
  });
});
