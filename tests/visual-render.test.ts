import { describe, expect, it } from "vitest";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { createVisualTemplate } from "../src/lib/visual/templates";
import { renderVisualApp } from "../src/lib/visual/render";

describe("deterministic visual export", () => {
  it.each(["daily", "maintenance", "appointment"] as const)("generates compilable TSX for %s", (template) => {
    const doc = createVisualTemplate(template, randomUUID);
    doc.pages[0]!.components[0]!.props.text = '</script>"; alert(1); //';
    const file = renderVisualApp(doc);
    expect(file.path).toBe("src/App.tsx");
    expect(file.content).not.toContain("alert(1)");
    expect(renderVisualApp(doc)).toEqual(file);
    const out = ts.transpileModule(file.content, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
    expect(out.diagnostics).toEqual([]);
  });
  it("rejects invalid documents before generating code", () => expect(() => renderVisualApp({ script: "bad" })).toThrow());
});
