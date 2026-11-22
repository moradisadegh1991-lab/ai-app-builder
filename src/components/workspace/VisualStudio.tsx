"use client";
import { useEffect, useMemo, useState } from "react";
import { VisualCanvas } from "./VisualCanvas";
import { api } from "../api";
import { createVisualTemplate, type VisualTemplateId } from "@/lib/visual/templates";
import type { VisualComponent, VisualProject } from "@/lib/visual/schema";
import { editHistory, redoHistory, undoHistory, type History } from "@/lib/visual/history";
import { addPage, renamePage, removePage, movePage, addComponent, moveComponent, removeComponent, type AddableComponent } from "@/lib/visual/operations";

/** Early data-only draft editor: no AI, code generation, or real backend features. */
export function VisualStudio({ base, canCreate }: { base: string; canCreate: boolean }) {
  const [draft, setDraft] = useState<VisualProject | null>(null);
  const [past, setPast] = useState<VisualProject[]>([]), [future, setFuture] = useState<VisualProject[]>([]);
  const [pageId, setPageId] = useState(""), [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [dirty, setDirty] = useState(false), [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("mobile");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setDraft(null); setPageId(""); setSelected(""); setPast([]); setFuture([]); setDirty(false); setError("");
    api<{ document: VisualProject | null }>(`${base}/visual`, { signal: controller.signal }).then(({ document }) => {
      if (controller.signal.aborted) return;
      setDraft(document); setPageId(document?.pages[0]?.id ?? "");
    }).catch(() => { if (!controller.signal.aborted) setError("بارگذاری ویرایشگر ممکن نشد؛ صفحه را دوباره باز کنید."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const page = useMemo(() => draft?.pages.find((item) => item.id === pageId), [draft, pageId]);
  const node = page?.components.find((item) => item.id === selected);
  const create = (kind: VisualTemplateId) => {
    const value = createVisualTemplate(kind, () => crypto.randomUUID());
    setDraft(value); setPageId(value.pages[0]!.id); setSelected(""); setPast([]); setFuture([]); setDirty(true); setError("");
  };
  const changeDocument = (change: (doc: VisualProject) => VisualProject) => {
    if (!draft || saving) return false;
    try {
      const next = change(draft);
      if (next === draft) return false;
      const result = editHistory({ past, present: draft, future }, next);
      setPast(result.past); setDraft(result.present); setFuture(result.future); setDirty(true); setError(""); return true;
    } catch { setError("این تغییر با محدودیت‌های ویرایشگر سازگار نیست."); return false; }
  };
  const updateNode = (change: (target: VisualComponent) => void) => {
    if (!draft || !node || saving) return;
    const next = structuredClone(draft), target = next.pages.find(p => p.id === pageId)?.components.find(c => c.id === selected);
    if (!target) return;
    change(target);
    const result = editHistory({ past, present: draft, future }, next);
    setPast(result.past); setDraft(result.present); setFuture(result.future); setDirty(true);
  };
  const update = (value: string) => updateNode(target => { target.props.text = value.slice(0, 2000); });
  const numberStyle = (key: "fontSize" | "padding" | "margin" | "radius", value: string) => {
    if (value === "") return;
    const n = Number(value), min = key === "fontSize" ? 10 : 0, max = key === "radius" ? 64 : 96;
    if (Number.isInteger(n) && n >= min && n <= max) updateNode(target => { target.style[key] = n; });
  };
  const applyHistory = (transition: (history: History<VisualProject>) => History<VisualProject>) => {
    if (!draft || saving) return;
    const result = transition({ past, present: draft, future });
    setPast(result.past); setDraft(result.present); setFuture(result.future); setDirty(true);
    if (!result.present.pages.some(p => p.id === pageId)) { setPageId(result.present.pages[0]!.id); setSelected(""); }
  };
  const undo = () => applyHistory(undoHistory);
  const redo = () => applyHistory(redoHistory);
  const save = async () => {
    if (!draft || saving) return;
    setSaving(true); setError("");
    try {
      const result = await api<{ document: VisualProject }>(`${base}/visual`, { method: "PUT", body: JSON.stringify(draft) });
      setDraft(result.document); setPast([]); setFuture([]); setDirty(false);
    } catch { setError("ذخیره انجام نشد؛ ممکن است نسخه در جای دیگری تغییر کرده باشد. پیش از بارگذاری مجدد متن خود را نگه دارید."); }
    finally { setSaving(false); }
  };
  const download = async () => {
    if (!draft || dirty || saving) return;
    setSaving(true); setError("");
    try {
      const { file, revision } = await api<{ file: { path: string; content: string }; revision: number }>(`${base}/visual/export`);
      if (revision !== draft.revision || file.path !== "src/App.tsx") throw new Error("stale revision");
      const url = URL.createObjectURL(new Blob([file.content], { type: "text/plain;charset=utf-8" }));
      try { const anchor = document.createElement("a"); anchor.href = url; anchor.download = "App.tsx"; anchor.click(); }
      finally { URL.revokeObjectURL(url); }
    } catch { setError("خروجی آماده نشد؛ پیش‌نویس را ذخیره و دوباره تلاش کنید."); }
    finally { setSaving(false); }
  };
  return <section className="panel p-5 mt-4" aria-label="پیش‌نویس ویرایشگر بصری">
    <h2 className="font-bold">پیش‌نویس ویرایشگر بصری</h2>
    <p className="text-sm text-muted mt-2">ویرایش و پیش‌نمایش بدون AI است. داده‌ها نمونه‌اند؛ فرم‌ها و ساخت خروجی از این ویرایشگر هنوز فعال نیستند.</p>
    {loading ? <p role="status">در حال بارگذاری…</p> : error && !draft ? <p role="alert">{error}</p> : !draft && !canCreate ? <p className="mt-3 text-sm text-muted">این پروژه دارای کد تولیدشده است؛ ویرایش فعلی آن در بخش کد ادامه دارد.</p> : !draft ? <div className="flex flex-wrap gap-2 mt-4">
      <button className="btn-secondary" onClick={() => create("daily")}>قالب گزارش روزانه</button><button className="btn-secondary" onClick={() => create("maintenance")}>قالب تعمیرات</button><button className="btn-secondary" onClick={() => create("appointment")}>قالب نوبت‌دهی</button>
    </div> : <>
      <div className="flex flex-wrap gap-2 mt-4">{draft.pages.map(p => <button type="button" key={p.id} className="btn-secondary" aria-pressed={pageId === p.id} onClick={() => { setPageId(p.id); setSelected(""); }}>{p.title}</button>)}</div>
      {page && <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm">نام صفحه<input key={`${page.id}:${page.title}`} className="input mt-1" maxLength={100} defaultValue={page.title} disabled={saving} onBlur={e => { const title = e.target.value.trim(); if (title === page.title) return; if (!title || !changeDocument(doc => renamePage(doc, page.id, title))) e.target.value = page.title; }} /></label>
        <button type="button" className="btn-secondary" disabled={saving || draft.pages.length >= 30} onClick={() => { const id = crypto.randomUUID(); if (changeDocument(doc => addPage(doc, id))) { setPageId(id); setSelected(""); } }}>افزودن صفحه</button>
        <button type="button" className="btn-secondary" disabled={saving || draft.pages[0]?.id === page.id} onClick={() => changeDocument(doc => movePage(doc, page.id, -1))}>صفحه قبلی</button>
        <button type="button" className="btn-secondary" disabled={saving || draft.pages[draft.pages.length - 1]?.id === page.id} onClick={() => changeDocument(doc => movePage(doc, page.id, 1))}>صفحه بعدی</button>
        <button type="button" className="btn-secondary" disabled={saving || draft.pages.length <= 1} onClick={() => { if (window.confirm("این صفحه حذف شود؟")) { const first = draft.pages.find(p => p.id !== page.id); if (first && changeDocument(doc => removePage(doc, page.id))) { setPageId(first.id); setSelected(""); } } }}>حذف صفحه</button>
      </div>}
      <label className="block text-sm mt-3">جهت نوشتار<select className="input mt-1" disabled={saving} value={draft.designTokens.direction} onChange={e => { const direction = e.target.value; if (direction === "rtl" || direction === "ltr") changeDocument(doc => ({ ...doc, designTokens: { ...doc.designTokens, direction } })); }}><option value="rtl">راست به چپ</option><option value="ltr">چپ به راست</option></select></label>
      <div className="flex flex-wrap gap-2 mt-3">{(["mobile", "tablet", "desktop"] as const).map(d => <button type="button" className="btn-secondary" key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d === "mobile" ? "موبایل" : d === "tablet" ? "تبلت" : "دسکتاپ"}</button>)}</div>
      <div className="mt-3 overflow-auto"><div className="mx-auto border rounded-lg p-3" style={{ width: device === "mobile" ? 320 : device === "tablet" ? 768 : 1100 }} onClick={(event) => { const target = (event.target as HTMLElement).closest<HTMLElement>("[data-visual-id]"); if (target && page?.components.some(c => c.id === target.dataset.visualId)) setSelected(target.dataset.visualId ?? ""); }}><VisualCanvas project={draft} pageId={pageId} selectedId={selected} /></div></div>
      <div className="flex flex-wrap gap-2 mt-3">{page?.components.map(c => <button type="button" className="btn-secondary" key={c.id} aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}>{({ heading: "عنوان", text: "متن", button: "دکمه", card: "کارت", container: "ظرف", stack: "ستون", grid: "شبکه", divider: "جداکننده", image: "تصویر" } as const)[c.type]}</button>)}</div>
      {page && <div className="mt-3 flex flex-wrap gap-2" aria-label="افزودن المان">
        {([ ["text", "متن"], ["heading", "عنوان"], ["button", "دکمه نمونه"], ["card", "کارت"], ["container", "ظرف"], ["stack", "ستون"], ["grid", "شبکه"], ["divider", "جداکننده"] ] as [AddableComponent, string][]).map(([type, label]) => <button type="button" className="btn-secondary" key={type} disabled={saving || page.components.length >= 50} onClick={() => { const id = crypto.randomUUID(); if (changeDocument(doc => addComponent(doc, page.id, id, type))) setSelected(id); }}>+ {label}</button>)}
      </div>}
      {node && page && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={saving || page.components[0]?.id === node.id} onClick={() => changeDocument(doc => moveComponent(doc, page.id, node.id, -1))}>المان قبلی</button>
        <button type="button" className="btn-secondary" disabled={saving || page.components[page.components.length - 1]?.id === node.id} onClick={() => changeDocument(doc => moveComponent(doc, page.id, node.id, 1))}>المان بعدی</button>
        <button type="button" className="btn-secondary" disabled={saving} onClick={() => { if (window.confirm("این المان حذف شود؟") && changeDocument(doc => removeComponent(doc, page.id, node.id))) setSelected(""); }}>حذف المان</button>
      </div>}
      {node && <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {["text", "heading", "button"].includes(node.type) && <label className="block text-sm sm:col-span-2">متن المان انتخاب‌شده<input className="input mt-1" disabled={saving} value={node.props.text ?? ""} onChange={e => update(e.target.value)} maxLength={2000} /></label>}
        <label className="block text-sm">رنگ متن<input className="input mt-1" type="color" disabled={saving} value={node.style.color ?? draft.designTokens.primary} onChange={e => updateNode(target => { target.style.color = e.target.value; })} /></label>
        <label className="block text-sm">رنگ پس‌زمینه<input className="input mt-1" type="color" disabled={saving} value={node.style.background ?? draft.designTokens.background} onChange={e => updateNode(target => { target.style.background = e.target.value; })} /></label>
        {([ ["fontSize", "اندازه متن", 10, 96], ["padding", "فاصله داخلی", 0, 96], ["margin", "فاصله بیرونی", 0, 96], ["radius", "گردی گوشه", 0, 64] ] as const).map(([key, label, min, max]) => <label className="block text-sm" key={key}>{label} ({node.style[key] ?? (key === "fontSize" ? 16 : 0)})<input className="input mt-1" type="range" min={min} max={max} step={1} disabled={saving} value={node.style[key] ?? (key === "fontSize" ? 16 : 0)} onChange={e => numberStyle(key, e.target.value)} /></label>)}
        <label className="block text-sm">عرض<select className="input mt-1" disabled={saving} value={node.style.width ?? "auto"} onChange={e => { const value = e.target.value; if (value === "auto" || value === "full" || value === "half") updateNode(target => { target.style.width = value; }); }}><option value="auto">خودکار</option><option value="full">کامل</option><option value="half">نیمه</option></select></label>
        <label className="block text-sm">تراز<select className="input mt-1" disabled={saving} value={node.style.align ?? "start"} onChange={e => { const value = e.target.value; if (value === "start" || value === "center" || value === "end") updateNode(target => { target.style.align = value; }); }}><option value="start">ابتدا</option><option value="center">وسط</option><option value="end">انتها</option></select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={saving} checked={node.style.visible !== false} onChange={e => updateNode(target => { target.style.visible = e.target.checked; })} />نمایش المان</label>
      </div>}
      <div className="flex flex-wrap gap-2 mt-4"><button type="button" className="btn-secondary" disabled={!past.length || saving} onClick={undo}>بازگشت</button><button type="button" className="btn-secondary" disabled={!future.length || saving} onClick={redo}>انجام دوباره</button><button type="button" className="btn-primary" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "در حال انجام…" : "ذخیره پیش‌نویس"}</button><button type="button" className="btn-secondary" disabled={dirty || saving || draft.revision < 1} onClick={() => void download()}>دریافت کد پیش‌نویس</button></div>
      {error && <p role="alert" className="mt-2 text-sm text-danger-fg">{error}</p>}{!error && !dirty && <p role="status" className="mt-2 text-sm text-muted">پیش‌نویس ذخیره شده است.</p>}
    </>}
  </section>;
}
