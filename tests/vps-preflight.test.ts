import { describe, expect, it } from "vitest";
import { selectEnvironment, summarizeEnvironment } from "../scripts/vps-preflight.mjs";

describe("VPS read-only preflight redaction", () => {
  it("retains only expected inputs and never reports secrets or connection strings", () => {
    const selected = selectEnvironment("DATABASE_URL=postgres://user:password@localhost/db\0AI_GATEWAY_API_KEY=secret\0EXTRA_SECRET=hidden\0APP_URL=https://ideaapp.anzanagenticai.ir\0");
    expect(selected.EXTRA_SECRET).toBeUndefined();
    const report = summarizeEnvironment(selected);
    expect(report).toMatchObject({ database: "local-postgres", canonicalUrlMatches: true, gatewayKeyPresent: true });
    expect(JSON.stringify(report)).not.toMatch(/password|secret|postgres:\/\//);
  });
  it("does not treat invalid or missing values as configured", () => {
    expect(summarizeEnvironment({ DATABASE_URL: "not-a-url" })).toMatchObject({ database: "unknown", gatewayKeyPresent: false, budgetConfigPresent: false });
  });
});
