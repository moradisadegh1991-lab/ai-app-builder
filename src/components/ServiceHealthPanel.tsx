
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type HealthChecks = Record<string, boolean>;

interface HealthResponse {
  ok: boolean;
  checks: HealthChecks;
}

type CheckKind = "required" | "optional" | "platform";

interface CheckDefinition {
  key: string;
  label: string;
  description: string;
  group: string;
  kind: CheckKind;
}

const CHECKS: CheckDefinition[] = [
  {
    key: "database",
    label: "PostgreSQL",
    description: "برقراری ارتباط پایه با پایگاه داده",
    group: "زیرساخت",
    kind: "required",
  },
  {
    key: "schema",
    label: "Database Schema",
    description: "وجود ساختار موردنیاز دیتابیس و Migration",
    group: "زیرساخت",
    kind: "required",
  },
  {
    key: "appUrl",
    label: "Application URL",
    description: "تنظیم آدرس اصلی برنامه",
    group: "امنیت و پیکربندی",
    kind: "required",
  },
  {
    key: "encryptionKey",
    label: "Encryption Key",
    description: "اعتبار کلید رمزنگاری اطلاعات حساس",
    group: "امنیت و پیکربندی",
    kind: "required",
  },
  {
    key: "sessionSecret",
    label: "Session Secret",
    description: "اعتبار کلید امضای نشست کاربران",
    group: "امنیت و پیکربندی",
    kind: "required",
  },
  {
    key: "githubOAuth",
    label: "GitHub OAuth",
    description: "وجود Client ID و Client Secret",
    group: "اتصال‌ها",
    kind: "required",
  },
  {
    key: "googleLogin",
    label: "Google Login",
    description: "پیکربندی ورود با حساب Google",
    group: "اتصال‌ها",
    kind: "optional",
  },
  {
    key: "openai",
    label: "OpenAI Platform Key",
    description: "وجود کلید مرکزی OpenAI در سرور",
    group: "هوش مصنوعی",
    kind: "platform",
  },
  {
    key: "anthropic",
    label: "Anthropic Platform Key",
    description: "وجود کلید مرکزی Anthropic در سرور",
    group: "هوش مصنوعی",
    kind: "platform",
  },
  {
    key: "gemini",
    label: "Gemini Platform Key",
    description: "وجود کلید مرکزی Gemini در سرور",
    group: "هوش مصنوعی",
    kind: "platform",
  },
  {
    key: "aiGateway",
    label: "AI Gateway",
    description: "پیکربندی آدرس و کلید Gateway مرکزی",
    group: "هوش مصنوعی",
    kind: "optional",
  },
];

const GROUPS = [
  "زیرساخت",
  "امنیت و پیکربندی",
  "اتصال‌ها",
  "هوش مصنوعی",
];

function StatusBadge({
  status,
}: {
  status: "success" | "danger" | "neutral" | "loading";
}) {
  const config = {
    success: {
      label: "فعال",
      className:
        "bg-success-soft text-success-fg",
      dot: "bg-success",
    },
    danger: {
      label: "نیازمند تنظیم",
      className:
        "bg-danger-soft text-danger-fg",
      dot: "bg-danger",
    },
    neutral: {
      label: "اختیاری",
      className:
        "bg-surface-3 text-fg-2",
      dot: "bg-line-strong",
    },
    loading: {
      label: "در حال بررسی",
      className:
        "bg-info-soft text-info-fg",
      dot: "bg-info",
    },
  }[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold ${config.className}`}
    >
      <span className={`size-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function getCheckStatus(
  item: CheckDefinition,
  data: HealthResponse | null,
  loading: boolean,
) {
  if (!data) {
    return loading ? "loading" : "neutral";
  }

  const known = Object.prototype.hasOwnProperty.call(
    data.checks,
    item.key,
  );

  if (!known || typeof data.checks[item.key] !== "boolean") {
    return "neutral";
  }

  if (data.checks[item.key]) {
    return "success";
  }

  if (item.kind === "optional" || item.kind === "platform") {
    return "neutral";
  }

  return "danger";
}

function getCheckLabel(
  item: CheckDefinition,
  data: HealthResponse | null,
  loading: boolean,
) {
  if (!data) {
    return loading ? "در حال بررسی" : "نامشخص";
  }

  const known = Object.prototype.hasOwnProperty.call(
    data.checks,
    item.key,
  );

  if (!known || typeof data.checks[item.key] !== "boolean") {
    return "نامشخص";
  }

  if (data.checks[item.key]) {
    return "فعال";
  }

  if (item.kind === "optional") {
    return "پیکربندی نشده";
  }

  if (item.kind === "platform") {
    return "کلید مرکزی موجود نیست";
  }

  return "نیازمند تنظیم";
}

function CheckCard({
  item,
  data,
  loading,
}: {
  item: CheckDefinition;
  data: HealthResponse | null;
  loading: boolean;
}) {
  const status = getCheckStatus(item, data, loading);

  const extraDescription =
    data &&
    data.checks[item.key] === false &&
    item.kind === "platform"
      ? "در صورت ثبت کلید شخصی کاربر، امکان استفاده از ارائه‌دهنده همچنان وجود دارد."
      : data &&
          data.checks[item.key] === false &&
          item.kind === "optional"
        ? "فعال‌سازی این قابلیت الزامی نیست."
        : null;

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4 transition hover:border-line">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            dir="ltr"
            className="text-xs font-bold text-fg"
          >
            {item.label}
          </p>

          <p className="mt-1 text-[11px] leading-5 text-muted">
            {item.description}
          </p>
        </div>

        <StatusBadge status={status} />
      </div>

      {extraDescription && (
        <p className="mt-3 border-t border-line pt-2 text-[10px] leading-5 text-muted">
          {extraDescription}
        </p>
      )}

      {data &&
        item.kind === "required" &&
        data.checks[item.key] === false && (
          <p className="mt-3 border-t border-danger-line pt-2 text-[10px] leading-5 text-danger-fg">
            این مورد در وضعیت سلامت اصلی سیستم تأثیر دارد.
          </p>
        )}
    </div>
  );
}

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

      const result: unknown = await response.json();

      if (
        !result ||
        typeof result !== "object" ||
        !("checks" in result) ||
        !result.checks ||
        typeof result.checks !== "object"
      ) {
        throw new Error("پاسخ سرویس سلامت معتبر نیست.");
      }

      const healthResult = result as HealthResponse;

      setData(healthResult);
      setLastChecked(new Date());

      // The health endpoint intentionally returns 503 when
      // required configuration is missing. Its checks are still useful.
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

  const summary = useMemo(() => {
    if (!data) {
      return {
        passed: 0,
        failed: 0,
        total: 0,
        optionalMissing: 0,
        platformMissing: 0,
      };
    }

    const requiredChecks = CHECKS.filter(
      (item) => item.kind === "required",
    );

    const passed = requiredChecks.filter(
      (item) => data.checks[item.key] === true,
    ).length;

    const failed = requiredChecks.filter(
      (item) => data.checks[item.key] === false,
    ).length;

    const optionalMissing = CHECKS.filter(
      (item) =>
        item.kind === "optional" &&
        data.checks[item.key] === false,
    ).length;

    const platformMissing = CHECKS.filter(
      (item) =>
        item.kind === "platform" &&
        data.checks[item.key] === false,
    ).length;

    return {
      passed,
      failed,
      total: requiredChecks.length,
      optionalMissing,
      platformMissing,
    };
  }, [data]);

  const healthPercentage =
    summary.total > 0
      ? (summary.passed / summary.total) * 100
      : 0;

  return (
    <div className="space-y-5">
      {/* Overview */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                  !data
                    ? "bg-surface-3 text-muted"
                    : data.ok
                      ? "bg-success-soft text-success-fg"
                      : "bg-warning-soft text-warning-fg"
                }`}
              >
                <span className="text-xl" aria-hidden="true">
                  {!data ? "◷" : data.ok ? "✓" : "!"}
                </span>
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint">
                  SYSTEM HEALTH
                </p>

                <h3 className="mt-2 text-lg font-extrabold text-fg">
                  سلامت پیکربندی سیستم
                </h3>

                <p className="mt-2 text-xs leading-6 text-muted">
                  {data
                    ? data.ok
                      ? "تمام بررسی‌های ضروری سیستم موفق بوده‌اند."
                      : "برخی از تنظیمات ضروری سیستم نیازمند بررسی هستند."
                    : "در انتظار دریافت اطلاعات وضعیت سیستم..."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="btn-secondary shrink-0"
            >
              <span
                className={loading ? "animate-spin" : ""}
                aria-hidden="true"
              >
                ↻
              </span>

              {loading ? "در حال بررسی..." : "بررسی مجدد"}
            </button>
          </div>

          {/* Progress */}
          {data && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-fg-2">
                  بررسی‌های ضروری
                </span>

                <span className="text-xs font-bold tabular-nums text-fg-2">
                  {summary.passed} از {summary.total}
                </span>
              </div>

              <div
                className="h-2 overflow-hidden rounded-full bg-surface-3"
                role="progressbar"
                aria-label="درصد بررسی‌های ضروری موفق"
                aria-valuenow={Math.round(healthPercentage)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    summary.failed > 0
                      ? "bg-warning"
                      : "bg-success"
                  }`}
                  style={{ width: `${healthPercentage}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px]">
                <span className="text-success-fg">
                  {summary.passed} مورد موفق
                </span>

                <span className="text-danger-fg">
                  {summary.failed} مورد نیازمند تنظیم
                </span>
              </div>
            </div>
          )}

          {/* Last checked */}
          {lastChecked && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-[10px] text-faint">
                آخرین بررسی:{" "}
                <span className="font-semibold tabular-nums">
                  {lastChecked.toLocaleString("fa-IR", {
                    dateStyle: "medium",
                    timeStyle: "medium",
                    timeZone: "Asia/Tehran",
                  })}
                </span>
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-danger-line bg-danger-soft p-3 text-xs leading-6 text-danger-fg"
            >
              <p className="font-bold">خطا در دریافت وضعیت سرویس‌ها</p>
              <p className="mt-1">{error}</p>
            </div>
          )}
        </div>
      </section>

      {/* Groups */}
      {GROUPS.map((group) => {
        const items = CHECKS.filter(
          (item) => item.group === group,
        );

        const groupPassed = data
          ? items.filter(
              (item) => data.checks[item.key] === true,
            ).length
          : 0;

        return (
          <section
            key={group}
            className="rounded-2xl border border-line bg-surface p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-extrabold text-fg">
                {group}
              </h4>

              {data && (
                <span className="text-[10px] font-semibold text-faint">
                  {groupPassed} از {items.length} فعال
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <CheckCard
                  key={item.key}
                  item={item}
                  data={data}
                  loading={loading}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* AI configuration note */}
      {data && summary.platformMissing > 0 && (
        <div className="rounded-2xl border border-info-line bg-info-soft p-4">
          <p className="text-xs font-bold text-info-fg">
            درباره کلیدهای مرکزی هوش مصنوعی
          </p>

          <p className="mt-2 text-xs leading-6 text-info-fg">
            نبود کلید مرکزی در متغیرهای محیطی سرور، به‌تنهایی به معنی
            غیرفعال بودن ارائه‌دهنده نیست. اگر کاربر کلید شخصی ثبت کرده
            باشد، سیستم می‌تواند مطابق منطق فعلی از کلید شخصی او استفاده کند.
          </p>
        </div>
      )}

      {/* Technical note */}
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <p className="text-[11px] font-bold text-fg-2">
          محدوده بررسی سلامت
        </p>

        <p className="mt-2 text-[11px] leading-7 text-muted">
          این پنل وضعیت پیکربندی و دسترسی پایه پایگاه داده را از API سلامت
          سیستم دریافت می‌کند. فعال بودن یک مورد به معنی آزمایش واقعی API
          خارجی، اعتبارسنجی توکن سرویس یا موفقیت عملیات انتشار و تولید کد
          نیست. برای چنین آزمایش‌هایی باید Endpointهای اختصاصی و امن
          جداگانه پیاده‌سازی شوند.
        </p>
      </div>
    </div>
  );
}
