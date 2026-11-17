import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { randomUUID } from "node:crypto";
import { parseVisualProject } from "../src/lib/visual/schema";
import { VisualCanvas } from "../src/components/workspace/VisualCanvas";
describe("data-only visual canvas", () => {
  it("renders user text as text and hides invisible components without AI", () => {
    const id = randomUUID();
    const parsed = parseVisualProject({ schemaVersion: 1, revision: 0, designTokens: { primary: "#112233", background: "#ffffff", direction: "rtl" }, pages: [{ id, title: "خانه", route: "/", components: [
      { id: randomUUID(), type: "text", props: { text: "<script>alert(1)</script>" }, style: {}, children: [] },
      { id: randomUUID(), type: "heading", props: { text: "پنهان" }, style: { visible: false }, children: [] },
    ] }] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const html = renderToStaticMarkup(createElement(VisualCanvas, { project: parsed.data, pageId: id }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("پنهان");
  });
});
