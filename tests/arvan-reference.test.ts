import { describe, expect, it } from "vitest";
import { arvanReference, arvanRoleRecommendations, estimateReferencePrice } from "../src/lib/ai/arvan-reference";

describe("Arvan public reference prices", () => {
  it("covers recommended roles with dated nonzero prices", () => {
    expect(arvanReference.models.length).toBeGreaterThan(50);
    expect(arvanReference.retrievedAt).toBe("2026-11-22");
    for (const item of arvanRoleRecommendations) expect(estimateReferencePrice(item.model, 10000, 3000)).toBeGreaterThan(0);
    expect(estimateReferencePrice("Gemini 2.5 Pro", 10000, 3000)).toBe(13600);
    expect(estimateReferencePrice("Kimi K2.7 Code", 10000, 3000)).toBe(6880);
  });
  it("does not treat unknown models or invalid usage as free", () => {
    expect(estimateReferencePrice("unknown", 10000, 3000)).toBeNull();
    expect(estimateReferencePrice("Gemini 2.5 Pro", -1, 1)).toBeNull();
  });
});
