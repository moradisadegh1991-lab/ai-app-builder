import { describe, expect, it } from "vitest";
import { estimateTokens } from "../src/components/workspace/token-estimate";

describe("token planning estimate", () => {
  const base = { kind: "code" as const, textLength: 500, screens: 2, needsBackend: false, attachments: 0 };
  it("separates positive input and output ranges", () => {
    const x = estimateTokens(base);
    expect(x.input[0]).toBeGreaterThan(0);
    expect(x.input[1]).toBeGreaterThan(x.input[0]);
    expect(x.output[1]).toBeGreaterThan(x.output[0]);
  });
  it("reflects a backend and attachments without claiming a guaranteed cap", () => {
    const x = estimateTokens(base), server = estimateTokens({ ...base, needsBackend: true }), attached = estimateTokens({ ...base, attachments: 1 });
    expect(server.input[1]).toBeGreaterThan(x.input[1]);
    expect(server.output[1]).toBeGreaterThan(x.output[1]);
    expect(attached.input[1]).toBeGreaterThan(x.input[1]);
  });
  it("handles empty or invalid counts and requirements separately", () => {
    const x = estimateTokens({ ...base, kind: "spec", textLength: NaN, screens: 0, attachments: -1 });
    expect(x.input).toEqual([2000, 8000]);
    expect(x.output).toEqual([1000, 8000]);
  });
});
