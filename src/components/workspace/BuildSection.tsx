"use client";

import type { ProjectView } from "@/lib/projects";
import { GuideToggle } from "../guides/Guide";
import { Icon } from "../ui/Icon";
import { TONE_BADGE, buildStatus } from "../ui/status";
import { deployInfo } from "./model";
import { ExternalLink, Section } from "./parts";

export interface AutoFixControl {
  /** The saved choice has been read; until then the checkbox is disabled. */
  loaded: boolean;
  enabled: boolean;
  used: number;
  max: number;
  onChange: (value: boolean) => void;
}

function runningHint(status: string, isWebsite: boolean) {
  if (status === "in_progress") return isWebsite ? "معمولاً ۱ تا ۳ دقیقه" : "معمولاً ۵ تا ۱۵ دقیقه";
  return "وضعیت هر چند ثانیه خودکار به‌روز می‌شود";
}

/** GitHub repository, the latest GitHub Actions build, the APK download and build repair. */
export function BuildSection({
  project,
  githubConnected,
  disabled,
  onPush,
  onRebuild,
  onFix,
  autoFix,
}: {
  project: ProjectView;
  githubConnected: boolean;
  disabled: boolean;
  onPush: () => void;
  onRebuild: () => void;
  onFix: () => void;
  autoFix: AutoFixControl;
}) {
  const build = project.build;
  const isWebsite = project.kind === "website";
  const pushedCurrent = project.status === "pushed";
  const deploy = deployInfo(project);
  // Only a really deployed site has an address worth showing.
  const liveUrl = deploy.phase === "ready" && project.deployment?.url && /^https?:\/\//.test(project.deployment.url) ? project.deployment.url : null;
  const status = buildStatus(build, isWebsite);
  const running = Boolean(build && build.status !== "completed");

  if (!githubConnected) {
    return (
      <Section icon="git-branch" title={isWebsite ? "GitHub و Build سایت" : "GitHub و ساخت APK"} description="کد در مخزن خصوصی شما ذخیره و با GitHub Actions ساخته می‌شود.">
        <div className="flex flex-col gap-4">
          <div className="alert alert-warning">
            <Icon name="alert" className="mt-1" />
            <span>برای ذخیرهٔ کد و ساخت {isWebsite ? "سایت" : "APK"}، ابتدا حساب GitHub خود را متصل کنید (رایگان).</span>
          </div>
          <div>
            <a href="/api/auth/github" className="btn-primary">
              <Icon name="github" size={16} />
              اتصال GitHub
            </a>
          </div>
          <GuideToggle id="github" />
        </div>
      </Section>
    );
  }

  return (
    <Section
      icon="git-branch"
      title={isWebsite ? "GitHub و Build سایت" : "GitHub و ساخت APK"}
      description="هر ارسال به GitHub یک Build جدید در GitHub Actions اجرا می‌کند."
      actions={
        <button className="btn-primary btn-sm" disabled={disabled || pushedCurrent} onClick={onPush} title={pushedCurrent ? "آخرین نسخهٔ کد در GitHub است" : undefined}>
          <Icon name="upload" size={14} />
          {project.repo ? "ارسال نسخهٔ جدید" : "ساخت مخزن و شروع Build"}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="panel-muted flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Icon name="github" className="text-fg-2" />
            {project.repo ? (
              <ExternalLink href={project.repo.url} className="ltr min-w-0 truncate text-sm">
                {project.repo.owner}/{project.repo.name}
              </ExternalLink>
            ) : (
              <span className="text-sm text-muted">مخزن هنوز ساخته نشده است.</span>
            )}
          </div>
          <span className={pushedCurrent ? "badge badge-success" : project.repo ? "badge badge-warning" : "badge"}>
            {pushedCurrent ? "آخرین نسخه ثبت شده" : project.repo ? "نسخهٔ جدید ارسال نشده" : "ارسال نشده"}
          </span>
        </div>

        {!build && project.repo && <p className="text-sm text-muted">هنوز Buildی گزارش نشده است.</p>}

        {build && (
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                    status.tone === "success"
                      ? "bg-success-soft text-success-fg"
                      : status.tone === "danger"
                        ? "bg-danger-soft text-danger-fg"
                        : status.tone === "info"
                          ? "bg-info-soft text-info-fg"
                          : "bg-surface-3 text-muted"
                  }`}
                >
                  {running ? <span className="spinner" aria-hidden="true" /> : <Icon name={status.tone === "success" ? "check" : status.tone === "danger" ? "x" : "clock"} />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                    Build {build.runNumber ? `#${build.runNumber.toLocaleString("fa-IR")}` : ""}
                    <span className={TONE_BADGE[status.tone]}>{status.label}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    <span className="ltr font-mono">commit {build.commitSha.slice(0, 7)}</span>
                    {running && <> · {runningHint(build.status, isWebsite)}</>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {build.runUrl && (
                  <a href={build.runUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                    <Icon name="terminal" size={14} />
                    گزارش Build
                  </a>
                )}
                {build.status === "completed" && (
                  <button className="btn-secondary btn-sm" disabled={disabled} onClick={onRebuild}>
                    <Icon name="refresh" size={14} />
                    Build مجدد
                  </button>
                )}
              </div>
            </div>

            {running && (
              <div className="progress mx-4 mb-4" aria-hidden="true">
                <span className="w-1/3 animate-pulse" />
              </div>
            )}

            {build.conclusion === "success" && !isWebsite && build.downloadable && (
              <div className="flex flex-col gap-3 border-t border-line bg-success-soft px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <a href={`/api/projects/${project.id}/apk`} className="btn-success">
                    <Icon name="download" size={16} />
                    دانلود فایل APK
                  </a>
                  <span className="text-xs text-success-fg">
                    <span className="ltr">{build.apkName}</span>
                    {build.apkSizeBytes ? ` · ${(build.apkSizeBytes / 1024 / 1024).toFixed(1)} MB` : ""} — نسخهٔ آزمایشی با امضای Debug
                  </span>
                </div>
                <GuideToggle id="install-apk" />
              </div>
            )}

            {build.conclusion === "success" && isWebsite && (
              <div className="border-t border-line px-4 py-3 text-sm">
                {deploy.phase === "ready" && liveUrl ? (
                  <div className="flex flex-wrap items-center gap-2 text-success-fg">
                    <Icon name="check-circle" size={16} />
                    {deploy.description}
                    <ExternalLink href={liveUrl} className="ltr break-all">
                      {liveUrl}
                    </ExternalLink>
                  </div>
                ) : deploy.phase === "failed" ? (
                  <div className="text-danger-fg">Build موفق بود، اما استقرار ناموفق است؛ بخش «استقرار» را ببینید.</div>
                ) : deploy.phase === "provisioning" || deploy.phase === "deploying" ? (
                  <div className="flex items-center gap-2 text-info-fg">
                    <span className="spinner" aria-hidden="true" />
                    Build موفق بود. {deploy.label}: {deploy.description}
                  </div>
                ) : (
                  <div className="text-success-fg">کد سایت با موفقیت ساخته شد. برای انتشار به بخش «استقرار» بروید.</div>
                )}
              </div>
            )}

            {build.conclusion === "failure" && (
              <div className="flex flex-col gap-3 border-t border-danger-line bg-danger-soft px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn-primary" disabled={disabled} onClick={onFix}>
                    <Icon name="hammer" size={16} />
                    اصلاح خودکار خطا با هوش مصنوعی
                  </button>
                  <span className="text-xs leading-6 text-danger-fg">گزارش خطای Build برای مدل ارسال می‌شود و نسخهٔ اصلاح‌شده دوباره Build می‌شود.</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-danger-fg">
                  <input type="checkbox" className="checkbox" checked={autoFix.enabled} disabled={!autoFix.loaded} onChange={(event) => autoFix.onChange(event.target.checked)} />
                  اصلاح خودکار بعد از هر شکست (حداکثر {autoFix.max.toLocaleString("fa-IR")} بار پشت‌سرهم؛ تا الان {autoFix.used.toLocaleString("fa-IR")} بار)
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
