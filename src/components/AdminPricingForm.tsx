"use client";
import { useState } from "react";

type Entry = { key: string; price: { inputTomanPerMillion: number; outputTomanPerMillion: number; updatedAt: string }; source?: "environment" | "saved" };
export function AdminPricingForm({ initialEntries }: { initialEntries: Entry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [model, setModel] = useState("google/gemini-2.5-pro");
  const initial = initialEntries.find(entry => entry.key === "liara:google/gemini-2.5-pro");
  const [input, setInput] = useState(initial ? String(initial.price.inputTomanPerMillion) : "");
  const [output, setOutput] = useState(initial ? String(initial.price.outputTomanPerMillion) : "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/ai-pricing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, inputTomanPerMillion: Number(input), outputTomanPerMillion: Number(output) }) });
      if (!response.ok) throw new Error("ثبت نرخ انجام نشد؛ مقادیر و دسترسی را بررسی کنید.");
      const { price } = await response.json();
      setEntries(previous => [...previous.filter(x => x.key !== `liara:${model}`), { key: `liara:${model}`, price, source: "saved" }]);
      setMessage("نرخ ذخیره شد و برای درخواست‌های بعدی اعمال می‌شود.");
    } catch { setMessage("ثبت نرخ انجام نشد؛ دوباره تلاش کنید."); }
    finally { setSaving(false); }
  }
  return <><form onSubmit={submit} className="panel mt-6 grid gap-4 p-6">
    <label className="grid gap-1">ارائه‌دهنده<input value="Liara AI Gateway" disabled className="input" /></label>
    <label className="grid gap-1">شناسه دقیق مدل<input required maxLength={200} pattern="[a-zA-Z0-9._/-]+" value={model} onChange={e => setModel(e.target.value)} className="input" dir="ltr" /></label>
    <label className="grid gap-1">هر یک میلیون توکن ورودی (تومان)<input required type="number" min="0.000001" max="1000000000000" step="any" value={input} onChange={e => setInput(e.target.value)} className="input" dir="ltr" /></label>
    <label className="grid gap-1">هر یک میلیون توکن خروجی (تومان)<input required type="number" min="0.000001" max="1000000000000" step="any" value={output} onChange={e => setOutput(e.target.value)} className="input" dir="ltr" /></label>
    <button disabled={saving} className="btn btn-primary" type="submit">{saving ? "در حال ذخیره…" : "ذخیره نرخ"}</button>
    {message && <p role="status">{message}</p>}
  </form><section className="panel mt-6 p-6"><h2 className="font-bold">نرخ‌های ثبت‌شده</h2>{entries.length === 0 ? <p className="mt-3 text-muted">هنوز نرخی تأیید نشده است.</p> : <ul className="mt-3 grid gap-3">{entries.map(entry => <li key={entry.key} className="border-b py-2"><span dir="ltr">{entry.key}</span> {entry.source === "environment" ? "(پیش‌فرض تخمینی)" : "(ثبت مدیر)"}: ورودی {entry.price.inputTomanPerMillion.toLocaleString("fa-IR")}، خروجی {entry.price.outputTomanPerMillion.toLocaleString("fa-IR")} تومان / میلیون توکن</li>)}</ul>}</section></>;
}
