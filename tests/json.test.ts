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
  it("preserves JavaScript regex escapes emitted without JSON encoding", () => {
    const raw = String.raw`{"files":[{"path":"src/App.tsx","content":"const words = /\w+\s+/; const emoji = /\u{1f600}/u;"}]}`;
    expect(extractJsonObject(raw)).toEqual({
      files: [{ path: "src/App.tsx", content: String.raw`const words = /\w+\s+/; const emoji = /\u{1f600}/u;` }],
    });
  });
  it("preserves literal newlines inside generated source strings", () => {
    expect(extractJsonObject('{"content":"line one\nline two"}')).toEqual({ content: "line one\nline two" });
  });
  it("keeps valid quotes, backslashes, Unicode and encoded newlines unchanged", () => {
    const value = { content: 'const text = "سلام";\nconst pattern = /\\w+/; const unicode = "\\u{1f600}";' };
    expect(extractJsonObject(JSON.stringify(value))).toEqual(value);
  });
  it("rejects truncated objects and structural errors instead of inventing code", () => {
    expect(() => extractJsonObject(String.raw`{"content":"/\w+/"`)).toThrow();
    expect(() => extractJsonObject(String.raw`{"a":"/\w+/" "b":1}`)).toThrow();
  });
});
