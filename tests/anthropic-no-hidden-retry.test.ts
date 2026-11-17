import { describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ construct: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class {
  beta = { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], model: "model", usage: { input_tokens: 3, output_tokens: 2 } }) }) } };
  constructor(options: unknown) { h.construct(options); }
} }));
import { callProvider } from "../src/lib/ai/providers";
describe("provider retry accounting", () => {
  it("disables SDK retries that could bypass a separately metered reservation", async () => {
    await callProvider("anthropic", { apiKey: "test", model: "model", system: "system", prompt: "prompt", maxOutputTokens: 10 });
    expect(h.construct).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0 }));
  });
});
