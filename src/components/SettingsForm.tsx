"use client";

import { useState } from "react";
import { api, type ProviderInfo } from "./api";

interface IntegrationSummary {
  provider: string;
  secretHint: string;
  metadata: Record<string, string>;
}

type MetaField = "teamId" | "orgId" | "model";
type ServiceGroup = "infrastructure" | "ai";

interface ServiceConfig {
  id: "vercel" | "neon" | "openai" | "anthropic" | "gemini";
  title: string;
  subtitle: string;
  description: string;
  secretLabel: string;
  helpUrl: string;
  meta?: {
    field: MetaField;
    label: string;
    placeholder: string;
  };
}

const SERVICES: ServiceConfig[] = [
  {
    id: "vercel",
    title: "Vercel",
    subtitle: "Deployment Platform",
    description:
      "برای استقرار نسخه وب اپلیکیشن و اجرای فرآیند انتشار پروژه‌ها.",
    secretLabel: "Vercel Access Token",
    helpUrl: "https://vercel.com/account/settings/tokens",
    meta: {
      field: "teamId",
      label: "Team ID (اختیاری)",
      placeholder: "team_xxx",
    },
  },
  {
    id: "neon",
    title: "Neon",
    subtitle: "PostgreSQL Database",
    description:
      "برای ایجاد و مدیریت دیتابیس PostgreSQL اختصاصی پروژه‌ها.",
    secretLabel: "Neon API Key",
    helpUrl: "https://console.neon.tech/app/settings/api-keys",
    meta: {
      field: "orgId",
      label: "Organization ID (اختیاری)",
      placeholder: "org-xxx",
    },
  },
  {
    id: "openai",
    title: "OpenAI",
    subtitle: "AI Provider",
    description:
      "استفاده از کلید شخصی OpenAI برای تولید مشخصات و کد پروژه.",
    secretLabel: "OpenAI API Key",
    helpUrl: "https://platform.openai.com/api-keys",
    meta: {
      field: "model",
      label: "مدل اختصاصی (اختیاری)",
      placeholder: "gpt-5",
    },
  },
  {
    id: "anthropic",
    title: "Anthropic Claude",
    subtitle: "AI Provider",
    description:
      "اتصال مستقیم به مدل‌های Claude با کلید API شخصی.",
    secretLabel: "Anthropic API Key",
    helpUrl: "https://console.anthropic.com/settings/keys",
    meta: {
      field: "model",
      label: "مدل اختصاصی (اختیاری)",
      placeholder: "claude-opus-5-5",
    },
  },
  {
    id: "gemini",
    title: "Google Gemini",
    subtitle: "AI Provider",
    description:
      "اتصال به مدل‌های Gemini با کلید اختصاصی Google AI Studio.",
    secretLabel: "Gemini API Key",
    helpUrl: "https://aistudio.google.com/apikey",
    meta: {
      field: "model",
      label: "مدل اختصاصی (اختیاری)",
      placeholder: "gemini-2.5-pro",
    },
  },
];

export function SettingsForm({
  initial,
  providers,
  serviceGroup,
}: {
  initial: IntegrationSummary[];
  providers: ProviderInfo[];
  serviceGroup: ServiceGroup;
}) {
  const [integrations, setIntegrations] = useState(initial);

  const services = SERVICES.filter((service) =>
    serviceGroup === "infrastructure"
      ? service.id === "vercel" || service.id === "neon"
      : service.id === "openai" ||
        service.id === "anthropic" ||
        service.id === "gemini",
  );

  function updateIntegrations(next: IntegrationSummary[]) {
    setIntegrations((previous) => {
      const relevantIds = services.map((service) => service.id);

      return [
        ...previous.filter(
          (item) => !relevantIds.includes(item.provider as ServiceConfig["id"]),
        ),
        ...next.filter(
          (item) => relevantIds.includes(item.provider as ServiceConfig["id"]),
        ),
      ];
    });
  }

  return (
    <div className="grid gap-4">
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          current={integrations.find(
            (item) => item.provider === service.id,
          )}
          platformAvailable={
            providers.find((provider) => provider.id === service.id)
              ?.source === "platform"
          }
          onChange={updateIntegrations}
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
  const [meta, setMeta] = useState(
    current?.metadata[service.meta?.field ?? ""] ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (secret.trim().length < 8) {
      setMessage({
        text: "کلید واردشده معتبر نیست.",
        ok: false,
      });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const data = await api<{
        integrations: IntegrationSummary[];
      }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          provider: service.id,
          secret,
          metadata: service.meta
            ? { [service.meta.field]: meta }
            : {},
        }),
      });

      onChange(data.integrations);
      setSecret("");

      setMessage({
        text: "اتصال با موفقیت ذخیره شد.",
        ok: true,
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "ذخیره اطلاعات ناموفق بود.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const confirmed = window.confirm(
      `آیا از حذف اتصال ${service.title} مطمئن هستید؟`,
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    try {
      const data = await api<{
        integrations: IntegrationSummary[];
      }>(`/api/settings?provider=${service.id}`, {
        method: "DELETE",
      });

      onChange(data.integrations);

      setSecret("");
      setMeta("");

      setMessage({
        text: "اتصال با موفقیت حذف شد.",
        ok: true,
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "حذف اتصال ناموفق بود.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  }

  const status = current
    ? {
        label: "کلید شخصی ثبت شده",
        className:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      }
    : platformAvailable
      ? {
          label: "کلید مرکزی فعال",
          className:
            "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
        }
      : {
          label: "بدون کلید",
          className:
            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        };

  return (
    <form
      onSubmit={save}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {service.id === "vercel"
                ? "V"
                : service.id === "neon"
                  ? "N"
                  : service.id === "openai"
                    ? "AI"
                    : service.id === "anthropic"
                      ? "CL"
                      : "G"}
            </div>

            <div className="min-w-0">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {service.title}
              </h4>

              <p
                dir="ltr"
                className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              >
                {service.subtitle}
              </p>

              <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                {service.description}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        {current && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50/70 px-3 py-2 dark:bg-emerald-950/30">
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              کلید ذخیره‌شده:
            </span>

            <code
              dir="ltr"
              className="text-xs font-bold text-emerald-800 dark:text-emerald-200"
            >
              {current.secretHint}
            </code>
          </div>
        )}

        {!current && platformAvailable && (
          <div className="mt-4 rounded-xl bg-sky-50/70 px-3 py-2 text-[11px] leading-6 text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
            در صورت نبود کلید شخصی، کلید مرکزی پلتفرم برای این ارائه‌دهنده
            قابل استفاده است.
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${service.id}-secret`}
              className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              {service.secretLabel}
            </label>

            <input
              id={`${service.id}-secret`}
              type="password"
              dir="ltr"
              autoComplete="new-password"
              className="input w-full"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder={
                current
                  ? "برای جایگزینی، کلید جدید را وارد کنید"
                  : "کلید API را وارد کنید"
              }
              minLength={8}
              maxLength={500}
              required
            />
          </div>

          {service.meta && (
            <div>
              <label
                htmlFor={`${service.id}-meta`}
                className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                {service.meta.label}
              </label>

              <input
                id={`${service.id}-meta`}
                dir="ltr"
                className="input w-full"
                value={meta}
                onChange={(event) => setMeta(event.target.value)}
                placeholder={service.meta.placeholder}
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || secret.trim().length < 8}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "در حال پردازش..." : current ? "جایگزینی کلید" : "ذخیره کلید"}
          </button>

          {current && (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 px-4 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              حذف اتصال
            </button>
          )}

          <a
            href={service.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-brand-600 underline underline-offset-4 hover:text-brand-700 dark:text-brand-400"
          >
            دریافت کلید از سرویس
          </a>
        </div>

        {message && (
          <p
            role="status"
            className={`mt-4 rounded-xl px-3 py-2 text-xs leading-6 ${
              message.ok
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}