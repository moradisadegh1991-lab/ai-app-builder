import { describe, expect, it } from "vitest";
import { isPricingAdmin, tariffInput } from "../src/lib/ai/admin-pricing";

describe("pricing administration", () => {
  it("requires an explicit exact user ID allowlist", () => {
    expect(isPricingAdmin("abc", undefined)).toBe(false);
    expect(isPricingAdmin("abc", "def, abc ")).toBe(true);
    expect(isPricingAdmin("abc", "abcdef")).toBe(false);
  });
  it("accepts only positive bounded token rates and safe model IDs", () => {
    const valid = { model: "google/gemini-2.5-pro", inputTomanPerMillion: 120000, outputTomanPerMillion: 800000 };
    expect(tariffInput.safeParse(valid).success).toBe(true);
    for (const invalid of [{ ...valid, inputTomanPerMillion: 0 }, { ...valid, outputTomanPerMillion: -1 }, { ...valid, model: "<script>" }, { ...valid, inputTomanPerMillion: Infinity }]) expect(tariffInput.safeParse(invalid).success).toBe(false);
  });
});
