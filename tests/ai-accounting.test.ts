import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { generateStructured } from "../src/lib/ai";
import { CompletionTruncatedError } from "../src/lib/ai/errors";
const h = vi.hoisted(() => ({
  call: vi.fn(),
  reserve: vi.fn(),
  settle: vi.fn(),
  release: vi.fn(),
}));
vi.mock("../src/lib/ai/providers", () => ({ callProvider: h.call }));
vi.mock("../src/lib/integrations/store", () => ({
  getIntegration: async () => null,
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
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("AI_GATEWAY_API_KEY", "");
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
  it("keeps free accounts on the economy role model", async () => {
    vi.stubEnv("AGENT_DESIGNER_MODEL", "expensive-model");
    vi.stubEnv("AGENT_DESIGNER_ECONOMY_MODEL", "economy-model");
    await generateStructured({ ...options, role: "designer" });
    expect(h.call).toHaveBeenCalledWith("openai", expect.objectContaining({ model: "economy-model" }));
  });
});
