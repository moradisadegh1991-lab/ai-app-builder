import { HttpError } from "../http";
import { parseVisualProject } from "./schema";

/** Generates a data-only React entry file. It does not execute AI or start a build. */
export function renderVisualApp(input: unknown) {
  const result = parseVisualProject(input);
  if (!result.success) throw new HttpError(400, "داده‌های ویرایشگر معتبر نیستند.");
  // Base64 is embedded as a literal; user text can never become TSX source.
  const payload = Buffer.from(JSON.stringify(result.data), "utf8").toString("base64");
  return { path: "src/App.tsx", content: `import { createElement, useEffect, useState, type CSSProperties, type ReactNode } from "react";
type Node = { id: string; type: string; props: { text?: string; alt?: string }; style: { color?: string; background?: string; fontSize?: number; padding?: number; margin?: number; radius?: number; width?: string; align?: "start" | "center" | "end"; visible?: boolean }; children: Node[] };
type Page = { id: string; title: string; route: string; components: Node[] };
const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob("${payload}"), c => c.charCodeAt(0)))) as { designTokens: { primary: string; background: string; direction: "rtl" | "ltr" }; pages: Page[] };
function item(node: Node): ReactNode {
 if (node.style.visible === false) return null;
 const style: CSSProperties = { color: node.style.color, backgroundColor: node.style.background, fontSize: node.style.fontSize, padding: node.style.padding, margin: node.style.margin, borderRadius: node.style.radius, width: node.style.width === "full" ? "100%" : node.style.width === "half" ? "50%" : undefined, textAlign: node.style.align, ...(node.type === "stack" ? { display: "flex", flexDirection: "column" } : {}), ...(node.type === "grid" ? { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))" } : {}) };
 const attr = { key: node.id, style }, children = node.children.map(item);
 switch (node.type) {
  case "text": return createElement("p", attr, node.props.text);
  case "heading": return createElement("h2", attr, node.props.text);
  case "button": return createElement("button", { ...attr, type: "button", disabled: true }, node.props.text);
  case "image": return createElement("div", { ...attr, role: "img", "aria-label": node.props.alt || "تصویر" }, "تصویر");
  case "divider": return createElement("hr", attr);
  case "card": return createElement("article", attr, ...children);
  default: return createElement("div", attr, ...children);
 }
}
export default function App() {
 const [route, setRoute] = useState(() => window.location.hash.slice(1) || "/");
 useEffect(() => { const update = () => setRoute(window.location.hash.slice(1) || "/"); window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update); }, []);
 const page = data.pages.find(p => p.route === route) ?? data.pages[0];
 return <main dir={data.designTokens.direction} style={{ color: data.designTokens.primary, backgroundColor: data.designTokens.background }}><nav>{data.pages.map(p => <a key={p.id} href={"#" + p.route}>{p.title} </a>)}</nav>{page?.components.map(item)}</main>;
}
` };
}
