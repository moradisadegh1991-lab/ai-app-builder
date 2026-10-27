import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "@/lib/billing/payments";
import { PLANS, isPaidPlan, priceToman } from "@/lib/billing/plans";

describe("plans", () => {
  it("orders limits from free to max", () => {
    const order = [PLANS.free, PLANS.plus, PLANS.pro, PLANS.max];
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!.windowTokens).toBeGreaterThan(order[i - 1]!.windowTokens);
      expect(order[i]!.weeklyTokens).toBeGreaterThan(order[i - 1]!.weeklyTokens);
      expect(order[i]!.priceUsd).toBeGreaterThan(order[i - 1]!.priceUsd);
    }
    for (const plan of order) expect(plan.weeklyTokens).toBeGreaterThanOrEqual(plan.windowTokens);
  });

  it("uses economy models only on the free plan", () => {
    expect(PLANS.free.modelTier).toBe("economy");
    expect([PLANS.plus, PLANS.pro, PLANS.max].every((p) => p.modelTier === "standard")).toBe(true);
  });

  it("converts prices to toman rounded to a thousand", () => {
    expect(priceToman(PLANS.plus, 0)).toBeNull();
    expect(priceToman(PLANS.plus, 101_234)).toBe(2_025_000);
    expect(priceToman(PLANS.free, 100_000)).toBe(0);
  });

  it("knows which plans are paid", () => {
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan("max")).toBe(true);
    expect(isPaidPlan("enterprise")).toBe(false);
  });
});

describe("Stripe webhook signature", () => {
  const secret = "whsec_test";
  const payload = JSON.stringify({ type: "checkout.session.completed" });
  const sign = (t: number, body = payload, key = secret) =>
    `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;
  const now = Math.floor(Date.now() / 1000);

  it("accepts a valid signature", () => {
    expect(verifyStripeSignature(payload, sign(now), secret)).toBe(true);
  });

  it("rejects a tampered body, a wrong key, an old timestamp or no header", () => {
    expect(verifyStripeSignature(payload + " ", sign(now), secret)).toBe(false);
    expect(verifyStripeSignature(payload, sign(now, payload, "other"), secret)).toBe(false);
    expect(verifyStripeSignature(payload, sign(now - 3600), secret)).toBe(false);
    expect(verifyStripeSignature(payload, null, secret)).toBe(false);
  });
});
