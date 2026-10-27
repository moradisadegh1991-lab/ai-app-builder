"use client";

import { useState } from "react";
import { api, type ProviderInfo } from "./api";

interface IntegrationSummary {
  provider: string;
  secretHint: string;
  metadata: Record<string, string>;
}

type MetaField = "teamId" | "orgId" | "model";

interface ServiceConfig {
  id: "vercel" | "neon" | "openai" | "anthropic" | "gemini";
  title: string;
  description: string;
  secretLabel: string;
  helpUrl: string;
  meta?: { field: MetaField; label: string; placeholder: string };
}

const SERVICES: ServiceConfig[] = [
  {
    id: "vercel",
    title: "Vercel",
    description: "برای استقرار API یا نسخه وب اپ. اپ GitHub باید روی حساب Vercel نصب باشد.",
    secretLabel: "Vercel Access Token",
    helpUrl: "https://vercel.com/account/settings/tokens",
    meta: { field: "teamId", label: "Team ID (اختیاری)", placeholder: "team_xxx" },
  },
  {
    id: "neon",
    title: "Neon",
    description: "برای ساخت دیتابیس PostgreSQL اختصاصی هر اپ.",
    secretLabel: "Neon API Key",
    helpUrl: "https://console.neon.tech/app/settings/api-keys",
    meta: { field: "orgId", label: "Organization ID (در صورت نیاز)", placeholder: "org-xxx" },
  },
  {
    id: "openai",
    title: "OpenAI (کلید شخصی)",
    description: "اختیاری؛ به‌جای کلید مرکزی و بدون محدودیت سهمیه.",
    secretLabel: "OpenAI API Key",
    helpUrl: "https://platform.openai.com/api-keys",
    meta: { field: "model", label: "مدل (اختیاری)", placeholder: "gpt-5" },
  },
  {
    id: "anthropic",
    title: "Claude (کلید شخصی)",
    description: "اختیاری؛ به‌جای کلید مرکزی و بدون محدودیت سهمیه.",
    secretLabel: "Anthropic API Key",
    helpUrl: "https://console.anthropic.com/settings/keys",
    meta: { field: "model", label: "مدل (اختیاری)", placeholder: "claude-opus-5-5" },
  },
  {
    id: "gemini",
    title: "Gemini (کلید شخصی)",
    description: "اختیاری؛ به‌جای کلید مرکزی و بدون محدودیت سهمیه.",
    secretLabel: "Gemini API Key",
    helpUrl: "https://aistudio.google.com/apikey",
    meta: { field: "model", label: "مدل (اختیاری)", placeholder: "gemini-2.5-pro" },
  },
];

export function SettingsForm({ initial, providers }: { initial: IntegrationSummary[]; providers: ProviderInfo[] }) {
  const [integrations, setIntegrations] = useState(initial);

  return (
    <div className="flex flex-col gap-4">
      {SERVICES.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          current={integrations.find((i) => i.provider === service.id)}
          platformAvailable={providers.find((p) => p.id === service.id)?.source === "platform"}
          onChange={setIntegrations}
        />
      ))}
    </div>
  );
}

function ServiceCard({
  service,
  current,
  platformAvailable,
  onChange,
}: {
  service: ServiceConfig;
  current?: IntegrationSummary;
  platformAvailable: boolean;
  onChange: (integrations: IntegrationSummary[]) => void;
}) {
  const [secret, setSecret] = useState("");
  const [meta, setMeta] = useState(current?.metadata[service.meta?.field ?? ""] ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const data = await api<{ integrations: IntegrationSummary[] }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          provider: service.id,
          secret,
          metadata: service.meta ? { [service.meta.field]: meta } : {},
        }),
      });
      onChange(data.integrations);
      setSecret("");
      setMessage("ذخیره شد.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const data = await api<{ integrations: IntegrationSummary[] }>(`/api/settings?provider=${service.id}`, {
        method: "DELETE",
      });
      onChange(data.integrations);
      setMessage("حذف شد.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{service.title}</h2>
        {current ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            متصل <span dir="ltr">{current.secretHint}</span>
          </span>
        ) : platformAvailable ? (
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            از کلید مرکزی استفاده می‌شود
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            متصل نیست
          </span>
        )}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {service.description}{" "}
        <a href={service.helpUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">
          دریافت کلید
        </a>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">{service.secretLabel}</label>
          <input
            type="password"
            dir="ltr"
            className="input"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={current ? "برای جایگزینی، کلید جدید را وارد کنید" : ""}
            required
            minLength={8}
          />
        </div>
        {service.meta && (
          <div>
            <label className="label">{service.meta.label}</label>
            <input
              dir="ltr"
              className="input"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder={service.meta.placeholder}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={busy || secret.length < 8}>
          ذخیره
        </button>
        {current && (
          <button type="button" className="btn-danger" disabled={busy} onClick={remove}>
            حذف اتصال
          </button>
        )}
        {message && <span className="text-sm text-slate-500">{message}</span>}
      </div>
    </form>
  );
}
