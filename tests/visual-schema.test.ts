import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { parseVisualProject } from "../src/lib/visual/schema";
const project = () => ({ schemaVersion: 1, revision: 0, designTokens: { primary: "#112233", background: "#ffffff", direction: "rtl" }, pages: [{ id: randomUUID(), title: "خانه", route: "/", components: [{ id: randomUUID(), type: "text", props: { text: "سلام" }, style: {}, children: [] }] }] });
describe("visual schema", () => {
  it("accepts bounded data-only projects", () => expect(parseVisualProject(project()).success).toBe(true));
  it("rejects scripts, HTML, unknown component types and arbitrary URLs", () => {
    for (const injection of [{ html: "<script>" }, { onClick: "alert(1)" }, { url: "javascript:alert(1)" }]) {
      const p = project(); Object.assign(p.pages[0]!.components[0]!.props, injection);
      expect(parseVisualProject(p).success).toBe(false);
    }
    const p = project(); p.pages[0]!.components[0]!.type = "script";
    expect(parseVisualProject(p).success).toBe(false);
  });
  it("rejects deeply nested and cyclic data before recursive parsing", () => {
    const p = project(); let child: Record<string, unknown> = p.pages[0]!.components[0]!;
    for (let i = 0; i < 100; i++) { const next = { nested: {} }; child.nested = next; child = next; }
    expect(parseVisualProject(p).success).toBe(false);
    const cyclic = project(); Object.assign(cyclic, { loop: cyclic });
    expect(parseVisualProject(cyclic).success).toBe(false);
  });
  it("rejects duplicate identifiers and routes", () => {
    const p = project(); p.pages.push(structuredClone(p.pages[0]!));
    expect(parseVisualProject(p).success).toBe(false);
  });
});
