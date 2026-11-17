import { createElement, type CSSProperties, type ReactNode } from "react";
import type { VisualComponent, VisualProject } from "@/lib/visual/schema";

/** Only trusted components render data; arbitrary user code and HTML are never evaluated. */
function renderNode(node: VisualComponent): ReactNode {
  if (node.style.visible === false) return null;
  const st: CSSProperties = {
    color: node.style.color, backgroundColor: node.style.background,
    fontSize: node.style.fontSize, padding: node.style.padding, margin: node.style.margin,
    borderRadius: node.style.radius,
    width: node.style.width === "full" ? "100%" : node.style.width === "half" ? "50%" : undefined,
    textAlign: node.style.align,
    ...(node.type === "stack" ? { display: "flex", flexDirection: "column" } : {}),
    ...(node.type === "grid" ? { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))" } : {}),
  };
  const attr = { key: node.id, style: st, "data-visual-id": node.id };
  const children = node.children.map(renderNode);
  switch (node.type) {
    case "text": return createElement("p", attr, node.props.text);
    case "heading": return createElement("h2", attr, node.props.text);
    case "button": return createElement("button", { ...attr, type: "button", disabled: true }, node.props.text);
    // Asset delivery is intentionally pending authorization; never dereference an untrusted URL.
    case "image": return createElement("div", { ...attr, role: "img", "aria-label": node.props.alt || "تصویر" }, "تصویر");
    case "divider": return createElement("hr", attr);
    case "card": return createElement("article", attr, ...children);
    default: return createElement("div", attr, ...children);
  }
}
export function VisualCanvas({ project, pageId }: { project: VisualProject; pageId: string }) {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) return <p role="status">صفحه پیدا نشد.</p>;
  return <div dir={project.designTokens.direction} style={{ color: project.designTokens.primary, backgroundColor: project.designTokens.background }} aria-label={`پیش‌نمایش ${page.title}`}>
    {page.components.map(renderNode)}
  </div>;
}
