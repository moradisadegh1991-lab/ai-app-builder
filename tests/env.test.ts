import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";

describe("APP_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is used without a trailing slash", () => {
    vi.stubEnv("APP_URL", "https://idea2app.example.com///");
    expect(env.appUrl()).toBe("https://idea2app.example.com");
  });

  it("falls back to localhost in development only", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(env.appUrl()).toBe("http://localhost:3000");
  });

  it("must be set in production, so OAuth never silently redirects to localhost", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => env.appUrl()).toThrow(/APP_URL is not set/);
  });
});
