import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizedMaintenance } from "../src/lib/workflows/cron-auth";

afterEach(() => vi.unstubAllEnvs());
describe("maintenance authentication", () => {
  it("fails closed without a configured secret", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(authorizedMaintenance(new Request("https://example.test", { headers: { authorization: "Bearer " } }))).toBe(
      false,
    );
  });
  it("requires the exact bearer bytes and safely rejects multibyte input", () => {
    vi.stubEnv("CRON_SECRET", "long-test-secret");
    for (const authorization of ["", "Bearer wrong", "Bearer ££££££££", "bearer long-test-secret"])
      expect(authorizedMaintenance(new Request("https://example.test", { headers: { authorization } }))).toBe(false);
    expect(
      authorizedMaintenance(
        new Request("https://example.test", { headers: { authorization: "Bearer long-test-secret" } }),
      ),
    ).toBe(true);
  });
});
