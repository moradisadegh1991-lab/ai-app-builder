"use client";
import { useEffect, useMemo, useState } from "react";
import { VisualCanvas } from "./VisualCanvas";
import { api } from "../api";
import { createVisualTemplate, type VisualTemplateId } from "@/lib/visual/templates";
import type { VisualComponent, VisualProject } from "@/lib/visual/schema";
import { editHistory, redoHistory, undoHistory, type History } from "@/lib/visual/history";

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
      <div className="flex flex-wrap gap-2 mt-3">{(["mobile", "tablet", "desktop"] as const).map(d => <button type="button" className="btn-secondary" key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d === "mobile" ? "موبایل" : d === "tablet" ? "تبلت" : "دسکتاپ"}</button>)}</div>
      <div className="mt-3 overflow-auto"><div className="mx-auto border rounded-lg p-3" style={{ width: device === "mobile" ? 320 : device === "tablet" ? 768 : 1100 }} onClick={(event) => { const target = (event.target as HTMLElement).closest<HTMLElement>("[data-visual-id]"); if (target && page?.components.some(c => c.id === target.dataset.visualId)) setSelected(target.dataset.visualId ?? ""); }}><VisualCanvas project={draft} pageId={pageId} /></div></div>
      <div className="flex flex-wrap gap-2 mt-3">{page?.components.map(c => <button type="button" className="btn-secondary" key={c.id} aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}>{c.type === "heading" ? "عنوان" : "متن"}</button>)}</div>
      {node && <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">متن المان انتخاب‌شده<input className="input mt-1" disabled={saving} value={node.props.text ?? ""} onChange={e => update(e.target.value)} maxLength={2000} /></label>
        <label className="block text-sm">رنگ متن<input className="input mt-1" type="color" disabled={saving} value={node.style.color ?? draft.designTokens.primary} onChange={e => updateNode(target => { target.style.color = e.target.value; })} /></label>
        <label className="block text-sm">رنگ پس‌زمینه<input className="input mt-1" type="color" disabled={saving} value={node.style.background ?? draft.designTokens.background} onChange={e => updateNode(target => { target.style.background = e.target.value; })} /></label>
        {([ ["fontSize", "اندازه متن", 10, 96], ["padding", "فاصله داخلی", 0, 96], ["margin", "فاصله بیرونی", 0, 96], ["radius", "گردی گوشه", 0, 64] ] as const).map(([key, label, min, max]) => <label className="block text-sm" key={key}>{label}<input className="input mt-1" type="number" min={min} max={max} step={1} disabled={saving} value={node.style[key] ?? min} onChange={e => numberStyle(key, e.target.value)} /></label>)}
        <label className="block text-sm">عرض<select className="input mt-1" disabled={saving} value={node.style.width ?? "auto"} onChange={e => { const value = e.target.value; if (value === "auto" || value === "full" || value === "half") updateNode(target => { target.style.width = value; }); }}><option value="auto">خودکار</option><option value="full">کامل</option><option value="half">نیمه</option></select></label>
        <label className="block text-sm">تراز<select className="input mt-1" disabled={saving} value={node.style.align ?? "start"} onChange={e => { const value = e.target.value; if (value === "start" || value === "center" || value === "end") updateNode(target => { target.style.align = value; }); }}><option value="start">ابتدا</option><option value="center">وسط</option><option value="end">انتها</option></select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={saving} checked={node.style.visible !== false} onChange={e => updateNode(target => { target.style.visible = e.target.checked; })} />نمایش المان</label>
      </div>}
      <div className="flex flex-wrap gap-2 mt-4"><button type="button" className="btn-secondary" disabled={!past.length || saving} onClick={undo}>بازگشت</button><button type="button" className="btn-secondary" disabled={!future.length || saving} onClick={redo}>انجام دوباره</button><button type="button" className="btn-primary" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "در حال انجام…" : "ذخیره پیش‌نویس"}</button><button type="button" className="btn-secondary" disabled={dirty || saving || draft.revision < 1} onClick={() => void download()}>دریافت کد پیش‌نویس</button></div>
      {error && <p role="alert" className="mt-2 text-sm text-danger-fg">{error}</p>}{!error && !dirty && <p role="status" className="mt-2 text-sm text-muted">پیش‌نویس ذخیره شده است.</p>}
    </>}
  </section>;
}
