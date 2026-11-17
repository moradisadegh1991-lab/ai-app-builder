import { describe, expect, it } from "vitest";
import { moneyLimits } from "../src/lib/workflows/budgets";
const caps = { platform_day: 100, platform_month: 200, user_day: 100, user_month: 200, project_day: 100, project_month: 200, run: 100 };
describe("configured toman caps", () => {
  it("keeps a common platform cap and applies the stricter free user cap", () => {
    const raw = JSON.stringify({ common: caps, free: { ...caps, platform_day: 1, user_day: 10, run: 5 } });
    expect(moneyLimits(raw, true)).toMatchObject({ platform_day: 100, user_day: 10, run: 5 });
    expect(moneyLimits(raw, false)).toMatchObject({ platform_day: 100, user_day: 100, run: 100 });
  });
  it("rejects incomplete, negative, fractional and nonnumeric settings", () => {
    expect(moneyLimits(undefined, true)).toBeNull();
    expect(moneyLimits(JSON.stringify({ common: caps }), false)).toBeNull();
    expect(moneyLimits(JSON.stringify({ common: caps, free: { ...caps, run: -1 } }), true)).toBeNull();
    expect(moneyLimits(JSON.stringify({ common: { ...caps, run: 1.1 }, free: caps }), true)).toBeNull();
    expect(moneyLimits(JSON.stringify({ common: caps, free: { ...caps, run: "100" } }), true)).toBeNull();
  });
});
