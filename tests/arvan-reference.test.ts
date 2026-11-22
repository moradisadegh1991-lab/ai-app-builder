import { describe, expect, it } from "vitest";
import { arvanReference, arvanReferenceRate, arvanDefaultModels, arvanRoleRecommendations, estimateReferencePrice } from "../src/lib/ai/arvan-reference";

describe("Arvan public reference prices", () => {
  it("covers recommended roles with dated nonzero prices", () => {
    expect(arvanReference.models.length).toBeGreaterThan(50);
    expect(arvanReference.retrievedAt).toBe("2026-11-22");
    for (const item of arvanRoleRecommendations) expect(estimateReferencePrice(item.model, 10000, 3000)).toBeGreaterThan(0);
    expect(estimateReferencePrice("Gemini 2.5 Pro", 10000, 3000)).toBe(13600);
    expect(estimateReferencePrice("Kimi K2.6", 10000, 3000)).toBe(6880);
  });
  it("maps only owner-confirmed IDs to reference rates and respects expiry", async () => {
    const { estimateToman } = await import("../src/lib/ai/cost-estimate");
    expect(arvanDefaultModels.frontend).toBe("Kimi-K2.6");
    expect(arvanReferenceRate("Gemini-2.5-Pro")).toMatchObject({ inputTomanPerMillion: 400000, outputTomanPerMillion: 3200000 });
    expect(arvanReferenceRate("unknown")).toBeNull();
    expect(estimateToman(arvanReferenceRate("Gemini-2.5-Pro"), 2, 6, Date.parse("2026-12-23T00:00:00Z"))).toBeNull();
  });
  it("does not treat unknown models or invalid usage as free", () => {
    expect(estimateReferencePrice("unknown", 10000, 3000)).toBeNull();
    expect(estimateReferencePrice("Gemini 2.5 Pro", -1, 1)).toBeNull();
  });
});
