import { parseVisualProject, type VisualComponent, type VisualProject } from "./schema";
export type AddableComponent = Exclude<VisualComponent["type"], "image">;
function checked(next: VisualProject): VisualProject {
  const result = parseVisualProject(next);
  if (!result.success) throw new Error("تغییر با محدودیت‌های ویرایشگر سازگار نیست.");
  return result.data;
}
export function addPage(doc: VisualProject, id: string): VisualProject {
  const next = structuredClone(doc);
  next.pages.push({ id, title: "صفحه جدید", route: `/page-${id.slice(0, 8)}`, components: [] });
  return checked(next);
}
export function renamePage(doc: VisualProject, pageId: string, title: string): VisualProject {
  const next = structuredClone(doc), page = next.pages.find(p => p.id === pageId);
  if (!page) throw new Error("صفحه پیدا نشد.");
  page.title = title; return checked(next);
}
export function removePage(doc: VisualProject, pageId: string): VisualProject {
  const next = structuredClone(doc); next.pages = next.pages.filter(p => p.id !== pageId); return checked(next);
}
export function movePage(doc: VisualProject, pageId: string, delta: -1 | 1): VisualProject {
  const next = structuredClone(doc), from = next.pages.findIndex(p => p.id === pageId), to = from + delta;
  if (from < 0 || to < 0 || to >= next.pages.length) return doc;
  [next.pages[from], next.pages[to]] = [next.pages[to]!, next.pages[from]!]; return checked(next);
}
export function addComponent(doc: VisualProject, pageId: string, id: string, type: AddableComponent): VisualProject {
  const next = structuredClone(doc), page = next.pages.find(p => p.id === pageId);
  if (!page) throw new Error("صفحه پیدا نشد.");
  const text = type === "heading" ? "عنوان جدید" : type === "text" ? "متن جدید" : type === "button" ? "دکمه نمونه" : undefined;
  page.components.push({ id, type, props: text ? { text } : {}, style: {}, children: [] }); return checked(next);
}
export function moveComponent(doc: VisualProject, pageId: string, id: string, delta: -1 | 1): VisualProject {
  const next = structuredClone(doc), page = next.pages.find(p => p.id === pageId);
  if (!page) throw new Error("صفحه پیدا نشد.");
  const from = page.components.findIndex(c => c.id === id), to = from + delta;
  if (from < 0 || to < 0 || to >= page.components.length) return doc;
  [page.components[from], page.components[to]] = [page.components[to]!, page.components[from]!]; return checked(next);
}
export function removeComponent(doc: VisualProject, pageId: string, id: string): VisualProject {
  const next = structuredClone(doc), page = next.pages.find(p => p.id === pageId);
  if (!page) throw new Error("صفحه پیدا نشد.");
  page.components = page.components.filter(c => c.id !== id); return checked(next);
}
