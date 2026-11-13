import { afterEach, describe, expect, it, vi } from "vitest";
import { isLiaraGateway, liaraModelPrice } from "../src/lib/ai/liara-pricing";

const gateway = "https://ai.liara.ir/api/workspace/v1";
const model = "google/gemini-2.5-pro";
const raw = JSON.stringify({ [model]: { inputTomanPerMillion: 120000, outputTomanPerMillion: 800000, updatedAt: "2026-01-01T00:00:00Z" } });
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("Liara model prices", () => {
  it("accepts a verified administrator rate only for the exact model and platform gateway", () => {
    expect(liaraModelPrice(raw, gateway, "platform", model)).toMatchObject({ inputTomanPerMillion: 120000, outputTomanPerMillion: 800000 });
    expect(liaraModelPrice(raw, gateway, "user", model)).toBeNull();
    expect(liaraModelPrice(raw, gateway, "platform", "google/gemini-2.5-flash")).toBeNull();
    expect(isLiaraGateway("https://ai.liara.ir.evil.test/v1", "platform")).toBe(false);
    expect(liaraModelPrice("broken", gateway, "platform", model)).toBeNull();
    expect(liaraModelPrice(JSON.stringify({ [model]: { inputTomanPerMillion: -1, outputTomanPerMillion: 1, updatedAt: "2026-01-01T00:00:00Z" } }), gateway, "platform", model)).toBeNull();
  });
  it("reads per-token USD rates from the public catalog, skips non-text models and caches a fetch", async () => {
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [
      { id: "embedding", pricing: { cost: "0.1" } },
      { id: "special", pricing: { prompt: "0.000001", completion: "0.00001", special_price: "$0.1/second" } },
      { id: "image-only", pricing: { prompt: "0.000001", completion: "0.00001" }, architecture: { output_modalities: ["image"] } },
      { id: model, pricing: { prompt: "0.00000125", completion: "0.00001" } },
    ] })));
    vi.stubGlobal("fetch", fetchMock);
    const { liaraCatalogPrice } = await import("../src/lib/ai/liara-pricing");
    expect(await liaraCatalogPrice(model)).toMatchObject({ inputPerMillion: 1.25, outputPerMillion: 10, currency: "USD", source: "liara-catalog" });
    expect(await liaraCatalogPrice("embedding")).toBeNull();
    expect(await liaraCatalogPrice("special")).toBeNull();
    expect(await liaraCatalogPrice("image-only")).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe("https://ai.liara.ir/v1/models");
    expect(fetchMock.mock.calls[0]![1]).not.toHaveProperty("headers");
  });
  it("does not fabricate a price when the catalog is unavailable or malformed", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"models":"invalid"}')));
    const { liaraCatalogPrice } = await import("../src/lib/ai/liara-pricing");
    expect(await liaraCatalogPrice(model)).toBeNull();
  });
});
