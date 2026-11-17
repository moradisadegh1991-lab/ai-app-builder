import { describe, expect, it } from "vitest";
import { estimateToman } from "../src/lib/ai/cost-estimate";

const now = Date.parse("2026-11-17T00:00:00Z");
const rate = { inputTomanPerMillion: 100_000, outputTomanPerMillion: 500_000, updatedAt: "2026-11-16T00:00:00Z" };

describe("conservative toman estimate", () => {
  it("separates input and output rates and rounds up", () => {
    expect(estimateToman(rate, 1000, 200, now)).toBe(200);
    expect(estimateToman(rate, 1, 0, now)).toBe(1);
    expect(estimateToman({ ...rate, outputTomanPerMillion: 1_000_000 }, 1000, 200, now)).toBe(300);
  });
  it("does not treat missing, stale, future, zero or malformed prices as free", () => {
    expect(estimateToman(null, 1, 1, now)).toBeNull();
    expect(estimateToman({ ...rate, updatedAt: "2026-01-01T00:00:00Z" }, 1, 1, now)).toBeNull();
    expect(estimateToman({ ...rate, updatedAt: "2027-01-01T00:00:00Z" }, 1, 1, now)).toBeNull();
    expect(estimateToman({ ...rate, inputTomanPerMillion: 0 }, 1, 1, now)).toBeNull();
    expect(estimateToman({ ...rate, outputTomanPerMillion: NaN }, 1, 1, now)).toBeNull();
  });
  it("rejects invalid token counts and arithmetic overflow", () => {
    expect(estimateToman(rate, -1, 0, now)).toBeNull();
    expect(estimateToman(rate, 1.5, 0, now)).toBeNull();
    expect(estimateToman({ ...rate, inputTomanPerMillion: 1e100 }, Number.MAX_SAFE_INTEGER, 0, now)).toBeNull();
  });
});
