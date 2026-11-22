import { describe, expect, it } from "vitest";
import { environmentTariffs, isPricingAdmin, tariffInput } from "../src/lib/ai/admin-pricing";

describe("pricing administration", () => {
  it("requires an explicit exact user ID allowlist", () => {
    expect(isPricingAdmin("abc", undefined)).toBe(false);
    expect(isPricingAdmin("abc", "def, abc ")).toBe(true);
    expect(isPricingAdmin("abc", "abcdef")).toBe(false);
  });
  it("shows validated environment defaults and ignores malformed entries", () => {
    const price = { inputTomanPerMillion: 750000, outputTomanPerMillion: 4500000, updatedAt: "2026-01-01T00:00:00Z" };
    expect(environmentTariffs(JSON.stringify({ "google/gemini-2.5-pro": price, "bad model": price, "other/model": { ...price, inputTomanPerMillion: -1 } }))).toMatchObject([{ key: "liara:google/gemini-2.5-pro", source: "environment" }]);
    expect(environmentTariffs("not json")).toEqual([]);
  });
  it("accepts only positive bounded token rates and safe model IDs", () => {
    const valid = { model: "google/gemini-2.5-pro", inputTomanPerMillion: 120000, outputTomanPerMillion: 800000 };
    expect(tariffInput.safeParse(valid).success).toBe(true);
    for (const invalid of [{ ...valid, inputTomanPerMillion: 0 }, { ...valid, outputTomanPerMillion: -1 }, { ...valid, model: "<script>" }, { ...valid, inputTomanPerMillion: Infinity }]) expect(tariffInput.safeParse(invalid).success).toBe(false);
  });
});
