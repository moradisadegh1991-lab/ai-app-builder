"use client";

import { useCallback, useEffect, useState } from "react";

type HealthChecks = Record<string, boolean>;

interface HealthResponse {
  ok: boolean;
  checks: HealthChecks;
}

const CHECKS: {
  key: string;
  label: string;
  description: string;
  group: string;
}[] = [
  {
    key: "database",
    label: "PostgreSQL",
    description: "برقراری ارتباط با پایگاه داده",
    group: "زیرساخت",
  },
  {
    key: "schema",
    label: "Database Schema",
    description: "بررسی ساختار و Migration دیتابیس",
    group: "زیرساخت",
  },
  {
    key: "appUrl",
    label: "Application URL",
    description: "تنظیم آدرس اصلی برنامه",
    group: "امنیت و پیکربندی",
  },
  {
    key: "encryptionKey",
    label: "Encryption Key",
    description: "اعتبار کلید رمزنگاری اطلاعات",
    group: "امنیت و پیکربندی",
  },
  {
    key: "sessionSecret",
    label: "Session Secret",
    description: "اعتبار کلید نشست کاربران",
    group: "امنیت و پیکربندی",
  },
  {
    key: "githubOAuth",
    label: "GitHub OAuth",
    description: "وجود Client ID و Client Secret",
    group: "اتصال‌ها",
  },
  {
    key: "googleLogin",
    label: "Google Login",
    description: "پیکربندی ورود با Google",
    group: "اتصال‌ها",
  },
  {
    key: "openai",
    label: "OpenAI Platform Key",
    description: "وجود کلید مرکزی OpenAI",
    group: "هوش مصنوعی",
  },
  {
    key: "anthropic",
    label: "Anthropic Platform Key",
    description: "وجود کلید مرکزی Anthropic",
    group: "هوش مصنوعی",
  },
  {
    key: "gemini",
    label: "Gemini Platform Key",
    description: "وجود کلید مرکزی Gemini",
    group: "هوش مصنوعی",
  },
  {
    key: "aiGateway",
    label: "AI Gateway",
    description: "پیکربندی آدرس و کلید Gateway",
    group: "هوش مصنوعی",
  },
];

export function ServiceHealthPanel() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/health", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as HealthResponse;

      if (!result || typeof result.checks !== "object") {
        throw new Error("پاسخ سرویس سلامت معتبر نیست.");
      }

      setData(result);
      setLastChecked(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "دریافت وضعیت سرویس‌ها ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = Array.from(new Set(CHECKS.map((item) => item.group)));

  const passedCount = data
    ? CHECKS.filter((item) => data.checks[item.key] === true).length
    : 0;

  const totalCount = CHECKS.length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">
              SYSTEM CONFIGURATION
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                سلامت پیکربندی سیستم
              </h3>

              {data && (
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                    data.ok
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {data.ok ? "بررسی‌های اصلی موفق" : "نیازمند بررسی"}
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {data
                ? `${passedCount} مورد از ${totalCount} بررسی دارای وضعیت موفق است.`
                : "در انتظار دریافت اطلاعات وضعیت سیستم..."}
            </p>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            <span className={loading ? "animate-spin" : ""}>↻</span>
            {loading ? "در حال بررسی..." : "بررسی مجدد"}
          </button>
        </div>

        {data && (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${(passedCount / totalCount) * 100}%`,
                }}
              />
            </div>

            {lastChecked && (
              <p className="mt-2 text-[10px] text-slate-400">
                آخرین بررسی:{" "}
                {lastChecked.toLocaleTimeString("fa-IR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {groups.map((group) => (
        <div
          key={group}
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <h4 className="mb-4 text-sm font-extrabold text-slate-800 dark:text-slate-200">
            {group}
          </h4>

          <div className="grid gap-3 sm:grid-cols-2">
            {CHECKS.filter((item) => item.group === group).map((item) => {
              const passed = data?.checks[item.key] === true;
              const known = data !== null && item.key in data.checks;

              return (
                <div
                  key={item.key}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="min-w-0">
                    <p
                      dir="ltr"
                      className="text-xs font-bold text-slate-800 dark:text-slate-200"
                    >
                      {item.label}
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                      !known
                        ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : passed
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {!known
                      ? loading
                        ? "بررسی..."
                        : "نامشخص"
                      : passed
                        ? "فعال"
                        : "تنظیم نشده"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-[11px] leading-6 text-slate-400">
        توجه: این بررسی‌ها وجود تنظیمات و دسترسی پایه دیتابیس را کنترل
        می‌کنند؛ اتصال واقعی به APIهای خارجی، اعتبار توکن‌ها یا اجرای
        موفق عملیات هر سرویس را تضمین نمی‌کنند.
      </p>
    </div>
  );
}