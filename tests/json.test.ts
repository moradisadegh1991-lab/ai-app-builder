import { describe, expect, it } from "vitest";
import { extractJsonObject } from "@/lib/ai/json";

describe("extractJsonObject", () => {
  it("parses plain JSON", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON", () => {
    expect(extractJsonObject('Here you go:\n```json\n{"files":[]}\n```')).toEqual({ files: [] });
  });

  it("parses JSON surrounded by prose", () => {
    expect(extractJsonObject('Sure! {"ok":true} Hope this helps.')).toEqual({ ok: true });
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJsonObject("no json here")).toThrow();
  });
});
