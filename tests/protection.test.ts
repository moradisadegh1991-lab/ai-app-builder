import { afterEach, describe, expect, it, vi } from "vitest";
import { clientKey } from "../src/lib/rate-limit";
import { verifyTurnstile } from "../src/lib/turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const request = (headers: Record<string, string>) => new Request("https://x.test", { headers });

describe("clientKey", () => {
  it("hashes the address instead of storing it, and is stable per address", () => {
    vi.stubEnv("SESSION_SECRET", "0123456789abcdef0123456789abcdef");
    const a = clientKey(request({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }));
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(a).not.toContain("203");
    expect(clientKey(request({ "x-real-ip": "203.0.113.5" }))).toBe(a);
    expect(clientKey(request({ "x-real-ip": "203.0.113.6" }))).not.toBe(a);
  });
});

describe("Turnstile", () => {
  it("is skipped when not configured", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    await expect(verifyTurnstile(undefined)).resolves.toBeUndefined();
  });

  it("requires a token and checks it with Cloudflare when configured", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    await expect(verifyTurnstile(undefined)).rejects.toMatchObject({ status: 400 });

    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyTurnstile("good-token", "203.0.113.5")).resolves.toBeUndefined();
    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("good-token");
    expect(body.get("remoteip")).toBe("203.0.113.5");

    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: false }))));
    await expect(verifyTurnstile("bad-token")).rejects.toMatchObject({ status: 400 });
  });

  it("fails closed with 503 when Cloudflare cannot be reached", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(verifyTurnstile("token")).rejects.toMatchObject({ status: 503 });
  });
});
