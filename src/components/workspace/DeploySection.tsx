"use client";

import { useState } from "react";
import type { ProjectView } from "@/lib/projects";
import { api } from "../api";
import { GuideToggle } from "../guides/Guide";
import type { GuideId } from "../guides/data";
import { Icon } from "../ui/Icon";
import { TONE_BADGE, VPS_STATUS, type Tone } from "../ui/status";
import { deployInfo, type DeployPhase } from "./model";
import { useAfterDelay } from "./useAfterDelay";
import { CopyBox, ExternalLink, Fact, Section } from "./parts";

/** On-device app: nothing to host, just install the APK. */
export function LocalDeploySection() {
  return (
    <Section icon="smartphone" title="اجرا روی گوشی" description="این اپ محلی است و به سرور یا فضای ابری نیاز ندارد.">
      <div className="flex flex-col gap-4">
        <div className="alert">
          <Icon name="info" className="mt-1" />
          <span>همهٔ داده‌ها روی خود گوشی ذخیره می‌شوند. کافی است فایل APK را از بخش «GitHub و APK» دانلود و نصب کنید.</span>
        </div>
        <GuideToggle id="install-apk" />
      </div>
    </Section>
  );
}

const PHASE_TONE: Record<DeployPhase, Tone> = { idle: "neutral", waiting: "warning", provisioning: "info", deploying: "info", ready: "success", failed: "danger" };

/** How long the user may watch "provisioning" before we say it looks stuck (client-side observation only). */
const PROVISIONING_SLOW_MS = 5 * 60_000;

function PhaseSteps({ phase }: { phase: DeployPhase }) {
  const steps: { id: DeployPhase; label: string }[] = [
    { id: "provisioning", label: "آماده‌سازی زیرساخت" },
    { id: "deploying", label: "استقرار روی Vercel" },
    { id: "ready", label: "منتشر شده" },
  ];
  const current = steps.findIndex((step) => step.id === phase);
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center" aria-label="مراحل استقرار">
      {steps.map((step, index) => {
        const done = index < current || phase === "ready";
        const active = index === current && phase !== "ready";
        return (
          <li key={step.id} aria-current={active ? "step" : undefined} className="flex items-center gap-2 sm:flex-1">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                done ? "bg-success text-white" : active ? "bg-info-soft text-info-fg ring-1 ring-info-line" : "border border-line-strong text-muted"
              }`}
            >
              {done ? <Icon name="check" size={12} strokeWidth={3} /> : active ? <span className="spinner !size-3" aria-hidden="true" /> : (index + 1).toLocaleString("fa-IR")}
            </span>
            <span className={`text-sm ${active ? "font-semibold text-fg" : done ? "text-fg-2" : "text-muted"}`}>{step.label}</span>
            {index < steps.length - 1 && <span className={`hidden h-px flex-1 sm:block ${done ? "bg-success" : "bg-line"}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Vercel (+ Neon when the project needs a database). */
export function CloudDeploySection({ project, disabled, onProvision }: { project: ProjectView; disabled: boolean; onProvision: () => void }) {
  const deployment = project.deployment;
  const info = deployInfo(project);
  const needsBackend = Boolean(project.spec?.needsBackend);
  const isWebsite = project.kind === "website";
  const phase = info.phase;
  const busy = phase === "provisioning" || phase === "deploying";
  const ready = phase === "ready";
  const failed = phase === "failed";
  const slowProvisioning = useAfterDelay(phase === "provisioning", PROVISIONING_SLOW_MS);
  // The address is shown only once the deployment is really ready.
  const liveUrl = ready && deployment?.url && /^https?:\/\//.test(deployment.url) ? deployment.url : null;

  return (
    <Section
      icon="cloud"
      title="استقرار روی Vercel + Neon"
      description={
        needsBackend
          ? `یک دیتابیس PostgreSQL در Neon ساخته و schema.sql اجرا می‌شود، سپس ${isWebsite ? "سایت و API" : "API"} روی Vercel مستقر می‌شود${isWebsite ? "." : " و نشانی API در Build بعدی APK قرار می‌گیرد."}`
          : isWebsite
            ? "سایت روی Vercel منتشر می‌شود و یک نشانی ‎*.vercel.app‎ با HTTPS می‌گیرد."
            : "این اپلیکیشن بدون سرور اجرا می‌شود."
      }
      actions={deployment && <span className={`${TONE_BADGE[PHASE_TONE[phase]]} badge-dot`}>{info.label}</span>}
    >
      <div className="flex flex-col gap-4 text-sm">
        {!needsBackend && !isWebsite ? (
          <div className="alert alert-success">
            <Icon name="check-circle" className="mt-1" />
            <span>این اپلیکیشن به استقرار ابری نیاز ندارد؛ نسخهٔ قابل نصب را از بخش Build بگیرید.</span>
          </div>
        ) : (
          <>
            {!deployment && (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <Icon name="rocket" />
                </span>
                <p className="font-semibold text-fg">هنوز استقراری ثبت نشده است</p>
                <p className="max-w-md text-xs leading-6">
                  پیش‌نیاز: توکن Vercel{needsBackend ? " و کلید Neon" : ""} در صفحهٔ «اتصال‌ها و کلیدها» و نصب اپ GitHub روی حساب Vercel.
                </p>
                <button type="button" className="btn-primary mt-2" disabled={disabled} onClick={onProvision}>
                  <Icon name="rocket" size={16} />
                  {needsBackend ? "ساخت دیتابیس Neon و استقرار روی Vercel" : "انتشار سایت روی Vercel"}
                </button>
              </div>
            )}

            {deployment && (
              <>
                {(busy || ready) && <PhaseSteps phase={phase} />}

                <div className={`grid gap-3 ${needsBackend ? "sm:grid-cols-2" : ""}`}>
                  {needsBackend && (
                    <div className="panel-muted flex items-start gap-3 p-3">
                      <Icon name="database" className="mt-0.5 text-muted" />
                      <div>
                        <div className="font-semibold text-fg">Neon PostgreSQL</div>
                        <div className={`mt-0.5 text-xs ${deployment.hasDatabase ? "text-success-fg" : phase === "provisioning" ? "text-info-fg" : "text-warning-fg"}`}>
                          {deployment.hasDatabase ? "دیتابیس متصل است" : phase === "provisioning" ? "در حال ساخت دیتابیس" : "اتصال دیتابیس تأیید نشده است"}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="panel-muted flex items-start gap-3 p-3">
                    <Icon name="cloud" className="mt-0.5 text-muted" />
                    <div>
                      <div className="font-semibold text-fg">Vercel</div>
                      <div className={`mt-0.5 text-xs ${ready ? "text-success-fg" : failed ? "text-danger-fg" : phase === "deploying" ? "text-info-fg" : "text-muted"}`}>
                        {ready ? "منتشر شده است" : failed ? "استقرار ناموفق" : phase === "deploying" ? "در حال Build و انتشار" : phase === "provisioning" ? "در حال ساخت پروژه" : "پروژه هنوز ساخته نشده است"}
                      </div>
                    </div>
                  </div>
                </div>

                {busy && (
                  <div role="status" className="alert alert-info">
                    <span className="spinner mt-1.5" aria-hidden="true" />
                    <div>
                      <div className="font-semibold">{info.label}</div>
                      <div className="text-xs leading-6">{info.description} وضعیت خودکار به‌روز می‌شود.</div>
                    </div>
                  </div>
                )}

                {slowProvisioning && (
                  <div role="note" className="alert alert-warning">
                    <Icon name="alert" className="mt-1" />
                    <span className="text-xs leading-6">
                      بیش از ۵ دقیقه است که این مرحله تغییری نکرده است. اگر درخواست ساخت در میانهٔ کار قطع شده باشد، از داخل صفحه قابل ادامه نیست و نیاز به بازیابی سمت سرور دارد؛ صفحه را دوباره باز کنید؛ اگر وضعیت همچنان همین بود، این حالت از داخل برنامه قابل ادامه نیست.
                    </span>
                  </div>
                )}

                {ready && !liveUrl && (
                  <div className="alert alert-warning">
                    <Icon name="alert" className="mt-1" />
                    <span>{info.description}</span>
                  </div>
                )}

                {liveUrl && (
                  <>
                    <div className="alert alert-success">
                      <Icon name="check-circle" className="mt-1" />
                      <span>{needsBackend ? "زیرساخت ابری پروژه آمادهٔ استفاده است." : info.description}</span>
                    </div>
                    <div className="panel-muted flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted">نشانی سایت / API</div>
                        <ExternalLink href={liveUrl} className="ltr mt-0.5 break-all">
                          {liveUrl}
                        </ExternalLink>
                      </div>
                      <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                        <Icon name="external" size={14} />
                        باز کردن
                      </a>
                    </div>
                  </>
                )}

                {failed && (
                  <div role="alert" className="flex flex-col gap-3 rounded-xl border border-danger-line bg-danger-soft p-3 text-danger-fg">
                    <div className="font-semibold">استقرار با خطا مواجه شد.</div>
                    {deployment.error ? (
                      <pre dir="auto" className="max-h-64 overflow-auto rounded-lg bg-surface p-3 text-xs whitespace-pre-wrap break-words text-fg-2">
                        {deployment.error}
                      </pre>
                    ) : (
                      <p className="text-xs">جزئیات خطا از سرور دریافت نشده است.</p>
                    )}
                    <p className="text-xs leading-6">{info.description} تنظیمات اتصال Vercel و Neon را در صفحهٔ «اتصال‌ها و کلیدها» بررسی کنید.</p>
                    <div>
                      <button type="button" className="btn-primary btn-sm" disabled={disabled} onClick={onProvision}>
                        <Icon name="refresh" size={14} />
                        تلاش دوباره
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
        <GuideToggle id="vercel-neon" />
      </div>
    </Section>
  );
}

interface InstallInstructions {
  token: string;
  command: string;
  cloudInit: string;
  expiresAt: string;
}

const VPS_GUIDES: Record<string, GuideId> = { own: "own-vps", oracle: "oracle", gcp: "gcp", aws: "aws" };

const CLOUD_INIT_LABEL: Record<string, string> = {
  oracle: "Initialization script (Oracle)",
  gcp: "Startup script (Google Cloud)",
  aws: "User data (AWS)",
};

const tehranTime = (value: string) => new Date(value).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" });

/** The deploy agent on the user's own or a free VPS: install command, live status, logs, repair. */
export function VpsDeploySection({
  project,
  disabled,
  onChange,
  onError,
  onFix,
  canFix,
  track,
}: {
  project: ProjectView;
  disabled: boolean;
  onChange: (project: ProjectView) => void;
  onError: (message: string | null) => void;
  onFix: () => void;
  canFix: boolean;
  /** Runs a request as a tracked operation so background polling cannot overwrite its result. */
  track: <T>(operation: () => Promise<T>) => Promise<T>;
}) {
  const [install, setInstall] = useState<InstallInstructions | null>(null);
  const [busy, setBusy] = useState(false);
  const vps = project.vps;
  const own = project.vpsProvider === "own";
  const status = vps ? (VPS_STATUS[vps.status] ?? { label: vps.status, tone: "neutral" as const }) : null;

  async function createCommand() {
    setBusy(true);
    onError(null);
    try {
      await track(async () => {
        const data = await api<{ install: InstallInstructions; project: ProjectView }>(`/api/projects/${project.id}/vps`, { method: "POST" });
        setInstall(data.install);
        onChange(data.project);
      });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("اتصال این سرور حذف شود؟ کلید استقرار از GitHub پاک می‌شود؛ خود سرور دست نمی‌خورد.")) return;
    setBusy(true);
    try {
      await track(async () => {
        const data = await api<{ project: ProjectView }>(`/api/projects/${project.id}/vps`, { method: "DELETE" });
        setInstall(null);
        onChange(data.project);
      });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      icon="server"
      title={own ? "استقرار روی VPS شخصی" : "استقرار روی VPS رایگان"}
      description={`ایجنت Idea2App کد را با یک کلید فقط‌خواندنی از GitHub می‌گیرد، Build می‌کند${project.spec?.needsBackend ? "، PostgreSQL و API را راه می‌اندازد" : ""}، با HTTPS منتشر می‌کند و هر ۲ دقیقه Commit جدید را خودکار مستقر می‌کند.`}
      actions={
        status &&
        vps?.registered && (
          // An online agent that stopped reporting is not shown as a plain success.
          <span className={`${TONE_BADGE[vps.stale && vps.status === "online" ? "warning" : status.tone]} badge-dot`}>
            {vps.stale && vps.status === "online" ? "فعال، بدون گزارش اخیر" : status.label}
          </span>
        )
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        {vps && vps.registered && status && (
          <div className="panel overflow-hidden">
            <dl className="divide-y divide-line px-4">
              <Fact label="سرور">
                <span className="ltr">
                  {vps.hostname}
                  {vps.ip ? ` · ${vps.ip}` : ""}
                </span>
              </Fact>
              {vps.url && vps.status === "online" && (
                <Fact label="نشانی">
                  <ExternalLink href={vps.url} className="ltr">
                    {vps.url}
                  </ExternalLink>
                </Fact>
              )}
              {vps.deployedCommit && (
                <Fact label="Commit مستقر">
                  <span className="ltr font-mono text-xs">{vps.deployedCommit.slice(0, 7)}</span>
                </Fact>
              )}
              {vps.lastReportAt && <Fact label="آخرین گزارش">{tehranTime(vps.lastReportAt)}</Fact>}
            </dl>
            {vps.lastMessage && <p className="border-t border-line px-4 py-2.5 text-xs text-muted">{vps.lastMessage}</p>}

            {vps.stale && (
              <div className="alert alert-warning m-3">
                <Icon name="alert" className="mt-1" />
                <span>
                  بیش از ۱۰ دقیقه است که سرور گزارشی نفرستاده؛ ممکن است خاموش یا بدون اینترنت باشد. روی سرور بزنید: <code className="kbd">sudo idea2app status</code>
                </span>
              </div>
            )}

            {vps.lastLog && (
              <details className="group border-t border-line px-4 py-3">
                <summary className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg">
                  <Icon name="terminal" size={14} />
                  گزارش آخرین استقرار
                </summary>
                <pre className="code-block mt-2 max-h-64 text-[11px]">{vps.lastLog}</pre>
              </details>
            )}

            {canFix && (
              <div className="flex flex-wrap items-center gap-3 border-t border-danger-line bg-danger-soft px-4 py-3">
                <button className="btn-primary" disabled={disabled} onClick={onFix}>
                  <Icon name="hammer" size={16} />
                  اصلاح خودکار خطا با هوش مصنوعی
                </button>
                <span className="text-xs leading-6 text-danger-fg">گزارش استقرار برای مدل ارسال می‌شود؛ کد اصلاح‌شده Commit و روی سرور دوباره مستقر می‌شود.</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
              <button className="btn-secondary btn-sm" disabled={disabled || busy} onClick={createCommand}>
                <Icon name="refresh" size={14} />
                نصب روی سرور دیگر / نصب دوباره
              </button>
              <button className="btn-danger btn-sm" disabled={busy} onClick={disconnect}>
                <Icon name="trash" size={14} />
                قطع اتصال سرور
              </button>
            </div>
          </div>
        )}

        {(!vps || !vps.registered) && !install && (
          <div className="empty-state">
            <span className="empty-state-icon">
              <Icon name="server" />
            </span>
            {vps && !vps.registered ? (
              <p className="max-w-md text-xs leading-6 text-warning-fg">
                منتظر اجرای نصب‌کننده روی سرور. اگر دستور قبلی را ندارید، دستور تازه بسازید (دستور قبلی باطل می‌شود).
              </p>
            ) : (
              <p className="font-semibold text-fg">سروری متصل نیست</p>
            )}
            <button className="btn-primary mt-2" disabled={disabled || busy} onClick={createCommand}>
              {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="terminal" size={16} />}
              {busy ? "در حال ساخت…" : own ? "ساخت دستور نصب" : "ساخت اسکریپت نصب خودکار"}
            </button>
          </div>
        )}

        {install && (
          <div className="flex flex-col gap-4 rounded-xl border border-primary-line bg-primary-soft/40 p-4">
            <div className="alert alert-warning">
              <Icon name="shield" className="mt-1" />
              <span>
                این دستور یک توکن یک‌بارمصرف دارد و تا {tehranTime(install.expiresAt)} معتبر است. آن را با کسی به اشتراک نگذارید. بعد از اجرا، این صفحه خودکار وضعیت سرور را نشان می‌دهد.
              </span>
            </div>
            {own ? (
              <>
                <CopyBox label="روی سرور (با SSH) این دستور را اجرا کنید:" value={install.command} />
                <details>
                  <summary className="text-xs font-medium text-muted hover:text-fg">سرور را تازه می‌سازید؟ اسکریپت cloud-init / user-data</summary>
                  <div className="mt-2">
                    <CopyBox label="cloud-init" value={install.cloudInit} />
                  </div>
                </details>
              </>
            ) : (
              <>
                <CopyBox
                  label={`این اسکریپت را هنگام ساخت سرور در ${CLOUD_INIT_LABEL[project.vpsProvider ?? "oracle"] ?? "cloud-init"} قرار دهید:`}
                  value={install.cloudInit}
                />
                <details>
                  <summary className="text-xs font-medium text-muted hover:text-fg">سرور را قبلاً ساخته‌اید؟ دستور SSH</summary>
                  <div className="mt-2">
                    <CopyBox label="روی سرور اجرا کنید:" value={install.command} />
                  </div>
                </details>
              </>
            )}
          </div>
        )}

        <GuideToggle id={VPS_GUIDES[project.vpsProvider ?? "own"] ?? "own-vps"} />
      </div>
    </Section>
  );
}
