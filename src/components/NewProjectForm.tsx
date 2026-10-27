"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type ProviderInfo, type ProvidersResponse } from "./api";

const EXAMPLES = [
  "یک اپ مدیریت هزینه با ثبت درآمد، دسته‌بندی هزینه‌ها، گزارش ماهانه و نمودار",
  "اپ ثبت و پیگیری درخواست‌های تعمیرات تجهیزات کارخانه با وضعیت، اولویت و تاریخچه",
  "اپ عادت‌سازی روزانه با یادآور، شمارنده روزهای پیوسته و آمار هفتگی",
];

export function NewProjectForm() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<"capacitor" | "expo">("capacitor");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [aiProvider, setAiProvider] = useState<ProviderInfo["id"] | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ProvidersResponse>("/api/ai/providers")
      .then((data) => {
        setProviders(data.providers);
        setAiProvider((current) => current || data.providers.find((p) => p.available)?.id || "");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!aiProvider) return setError("هیچ مدل هوش مصنوعی در دسترس نیست؛ از صفحه تنظیمات یک کلید API اضافه کنید.");
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ idea, name: name || undefined, template, aiProvider }),
      });
      router.push(`/projects/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <h2 className="text-lg font-bold">پروژه جدید</h2>
      <div>
        <label className="label" htmlFor="idea">
          ایده اپلیکیشن
        </label>
        <textarea
          id="idea"
          className="input min-h-32 resize-y"
          placeholder="ایده‌ات را با جزئیات بنویس: کاربران چه کسانی‌اند، چه صفحاتی لازم است، چه داده‌هایی ثبت می‌شود…"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          required
          minLength={15}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              type="button"
              key={example}
              onClick={() => setIdea(example)}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              {example.slice(0, 40)}…
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="name">
            نام انگلیسی کوتاه (اختیاری)
          </label>
          <input
            id="name"
            className="input"
            dir="ltr"
            placeholder="expense-tracker"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
        </div>
        <div>
          <label className="label" htmlFor="template">
            فناوری اپ
          </label>
          <select
            id="template"
            className="input"
            value={template}
            onChange={(e) => setTemplate(e.target.value as "capacitor" | "expo")}
          >
            <option value="capacitor">React + Capacitor (پیشنهادی، Build سریع‌تر)</option>
            <option value="expo">React Native (Expo)، رابط بومی</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="provider">
            مدل هوش مصنوعی
          </label>
          <select
            id="provider"
            className="input"
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value as ProviderInfo["id"])}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.label}
                {p.available ? ` (${p.source === "user" ? "کلید شخصی" : "کلید مرکزی"})` : " (غیرفعال)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div>
        <button className="btn-primary" disabled={busy || idea.trim().length < 15}>
          {busy ? "در حال ساخت پروژه…" : "ساخت پروژه و شروع تحلیل"}
        </button>
      </div>
    </form>
  );
}
