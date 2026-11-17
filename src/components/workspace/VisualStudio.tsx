"use client";
import { useEffect, useMemo, useState } from "react";
import { VisualCanvas } from "./VisualCanvas";
import { api } from "../api";
import { createVisualTemplate, type VisualTemplateId } from "@/lib/visual/templates";
import type { VisualProject } from "@/lib/visual/schema";

/** Early data-only draft editor: no AI, code generation, or real backend features. */
export function VisualStudio({ base }: { base: string }) {
  const [draft, setDraft] = useState<VisualProject | null>(null);
  const [past, setPast] = useState<VisualProject[]>([]), [future, setFuture] = useState<VisualProject[]>([]);
  const [pageId, setPageId] = useState(""), [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [dirty, setDirty] = useState(false), [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("mobile");
  useEffect(() => {
    const controller = new AbortController();
    api<{ document: VisualProject | null }>(`${base}/visual`, { signal: controller.signal }).then(({ document }) => {
      if (controller.signal.aborted) return;
      setDraft(document); setPageId(document?.pages[0]?.id ?? "");
    }).catch(() => { if (!controller.signal.aborted) setError("بارگذاری ویرایشگر ممکن نشد؛ صفحه را دوباره باز کنید."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base]);
  const page = useMemo(() => draft?.pages.find((item) => item.id === pageId), [draft, pageId]);
  const node = page?.components.find((item) => item.id === selected);
  const create = (kind: VisualTemplateId) => {
    const value = createVisualTemplate(kind, () => crypto.randomUUID());
    setDraft(value); setPageId(value.pages[0]!.id); setSelected(""); setPast([]); setFuture([]); setDirty(true); setError("");
  };
  const update = (value: string) => {
    if (!draft || !node || saving) return;
    const next = structuredClone(draft), target = next.pages.find(p => p.id === pageId)?.components.find(c => c.id === selected);
    if (!target) return;
    target.props.text = value.slice(0, 2000);
    setPast(items => [...items.slice(-49), draft]); setFuture([]); setDraft(next); setDirty(true);
  };
  const undo = () => { if (!draft || !past.length) return; setFuture(items => [draft, ...items].slice(0, 50)); setDraft(past[past.length - 1]!); setPast(items => items.slice(0, -1)); setDirty(true); };
  const redo = () => { if (!draft || !future.length) return; setPast(items => [...items, draft].slice(-50)); setDraft(future[0]!); setFuture(items => items.slice(1)); setDirty(true); };
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
    {loading ? <p role="status">در حال بارگذاری…</p> : error && !draft ? <p role="alert">{error}</p> : !draft ? <div className="flex flex-wrap gap-2 mt-4">
      <button className="btn-secondary" onClick={() => create("daily")}>قالب گزارش روزانه</button><button className="btn-secondary" onClick={() => create("maintenance")}>قالب تعمیرات</button><button className="btn-secondary" onClick={() => create("appointment")}>قالب نوبت‌دهی</button>
    </div> : <>
      <div className="flex flex-wrap gap-2 mt-4">{draft.pages.map(p => <button type="button" key={p.id} className="btn-secondary" aria-pressed={pageId === p.id} onClick={() => { setPageId(p.id); setSelected(""); }}>{p.title}</button>)}</div>
      <div className="flex flex-wrap gap-2 mt-3">{(["mobile", "tablet", "desktop"] as const).map(d => <button type="button" className="btn-secondary" key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d === "mobile" ? "موبایل" : d === "tablet" ? "تبلت" : "دسکتاپ"}</button>)}</div>
      <div className="mt-3 overflow-auto"><div className="mx-auto border rounded-lg p-3" style={{ width: device === "mobile" ? 320 : device === "tablet" ? 768 : 1100 }} onClick={(event) => { const target = (event.target as HTMLElement).closest<HTMLElement>("[data-visual-id]"); if (target && page?.components.some(c => c.id === target.dataset.visualId)) setSelected(target.dataset.visualId ?? ""); }}><VisualCanvas project={draft} pageId={pageId} /></div></div>
      <div className="flex flex-wrap gap-2 mt-3">{page?.components.map(c => <button type="button" className="btn-secondary" key={c.id} aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}>{c.type === "heading" ? "عنوان" : "متن"}</button>)}</div>
      {node && <label className="block text-sm mt-3">متن المان انتخاب‌شده<input className="input mt-1" disabled={saving} value={node.props.text ?? ""} onChange={e => update(e.target.value)} maxLength={2000} /></label>}
      <div className="flex flex-wrap gap-2 mt-4"><button type="button" className="btn-secondary" disabled={!past.length || saving} onClick={undo}>بازگشت</button><button type="button" className="btn-secondary" disabled={!future.length || saving} onClick={redo}>انجام دوباره</button><button type="button" className="btn-primary" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "در حال انجام…" : "ذخیره پیش‌نویس"}</button><button type="button" className="btn-secondary" disabled={dirty || saving || draft.revision < 1} onClick={() => void download()}>دریافت کد پیش‌نویس</button></div>
      {error && <p role="alert" className="mt-2 text-sm text-danger-fg">{error}</p>}{!error && !dirty && <p role="status" className="mt-2 text-sm text-muted">پیش‌نویس ذخیره شده است.</p>}
    </>}
  </section>;
}
