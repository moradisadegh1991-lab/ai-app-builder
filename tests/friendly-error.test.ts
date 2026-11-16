import { afterEach, describe, expect, it, vi } from "vitest";
import { friendlyError } from "../src/components/friendly-error";
import { api } from "../src/components/api";

afterEach(() => vi.unstubAllGlobals());

describe("user-facing errors", () => {
  it("offers the correct next step for credit and session issues", () => {
    expect(friendlyError('AI provider error 402: {"secret":"raw"}')).toContain("اعتبار");
    expect(friendlyError("401 Unauthorized")).toContain("وارد حساب");
  });
  it("does not expose raw stack traces or model output", () => {
    expect(friendlyError("Error: package.json internal token SECRET")).not.toMatch(/package|SECRET|Error/);
  });
  it("converts provider and network failures into safe user-facing messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "AI provider error 402: private details" }), { status: 402 })));
    await expect(api("/test")).rejects.toThrow("اعتبار سرویس هوش مصنوعی");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret internal network exception")));
    await expect(api("/test")).rejects.not.toThrow("secret internal");
  });
});
