"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectView } from "@/lib/projects";
import { api, type ProviderInfo, type ProvidersResponse } from "./api";
import { StatusBadge } from "./StatusBadge";
import { Icon } from "./ui/Icon";
import { ActivityPanel } from "./workspace/ActivityPanel";
import { BuildSection } from "./workspace/BuildSection";
import { CodeSection } from "./workspace/CodeSection";
import { CloudDeploySection, LocalDeploySection, VpsDeploySection } from "./workspace/DeploySection";
import { currentSection, nextAction, workspaceFacts, workspaceSections, type SectionId } from "./workspace/model";
import { OverviewSection } from "./workspace/OverviewSection";
import { PreviewSection } from "./workspace/PreviewSection";
import { RequirementsSection } from "./workspace/RequirementsSection";
import { WorkspaceNav } from "./workspace/WorkspaceNav";

type Busy = null | "spec" | "approve" | "code" | "github" | "rebuild" | "fix" | "edit" | "cloud";

const BUSY_MESSAGES: Record<Exclude<Busy, null>, string> = {
  spec: "هوش مصنوعی در حال تحلیل ایده است (معمولاً کمتر از یک دقیقه)…",
  approve: "در حال ذخیره…",
  code: "هوش مصنوعی در حال نوشتن کد است؛ ممکن است تا ۴ دقیقه طول بکشد…",
  github: "در حال ساخت Repository و ثبت کد در GitHub…",
  rebuild: "در حال شروع Build جدید…",
  fix: "هوش مصنوعی در حال بررسی گزارش خطا و اصلاح کد است…",
  edit: "هوش مصنوعی در حال اعمال تغییر روی کد است؛ بعد از آن Build جدید شروع می‌شود…",
  cloud: "در حال ساخت دیتابیس Neon و پروژه Vercel…",
};

const SECTION_IDS: SectionId[] = ["overview", "requirements", "code", "preview", "build", "deploy"];

function isAiProviderId(value: string): value is ProviderInfo["id"] {
  return value === "openai" || value === "anthropic" || value === "gemini";
}

export function ProjectWorkspace({ initialProject, githubConnected }: { initialProject: ProjectView; githubConnected: boolean }) {
  const [project, setProject] = useState(initialProject);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<ProviderInfo["id"]>(isAiProviderId(initialProject.aiProvider) ? initialProject.aiProvider : "openai");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(initialProject.lastError);
  const [section, setSection] = useState<SectionId>(() => currentSection(initialProject));

  useEffect(() => {
    api<ProvidersResponse>("/api/ai/providers")
      .then((data) => setProviders(data.providers))
      .catch(() => undefined);
  }, []);

  const run = useCallback(async (kind: Exclude<Busy, null>, url: string, method: string, body?: unknown) => {
    setBusy(kind);
    setError(null);
    try {
      const data = await api<{ project: ProjectView }>(url, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      setProject(data.project);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const base = `/api/projects/${project.id}`;

  // ---------------------------------------------------------------- navigation
  const go = useCallback((id: SectionId) => {
    setSection(id);
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      // ignore: the hash is only a convenience
    }
  }, []);

  // A #section in the address opens that section (read after mount to keep hydration identical).
  useEffect(() => {
    const hash = window.location.hash.slice(1) as SectionId;
    if (SECTION_IDS.includes(hash)) setSection(hash);
  }, []);

  /** Runs an action and, on success, moves to the section where its result is shown. */
  const runThen = useCallback(
    async (target: SectionId | null, ...args: Parameters<typeof run>) => {
      const ok = await run(...args);
      if (ok && target) go(target);
      return ok;
    },
    [run, go],
  );

  // ---------------------------------------------------------------- automatic build repair
  // After a failed build the page repairs it by itself, up to project.autoFix.max rounds in a row.
  const [autoFixEnabled, setAutoFixEnabled] = useState(true);
  const autoFixedBuild = useRef<string | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("i2a_autofix") === "off") setAutoFixEnabled(false);
    } catch {
      // storage unavailable: keep the default
    }
  }, []);

  useEffect(() => {
    const build = project.build;
    if (!autoFixEnabled || busy !== null || !build || build.conclusion !== "failure") return;
    if (project.autoFix.used >= project.autoFix.max || autoFixedBuild.current === build.id) return;
    // Only for a failure that just happened, not an old one found when the page is opened later.
    if (Date.now() - new Date(build.createdAt).getTime() > 60 * 60_000) return;
    autoFixedBuild.current = build.id;
    void run("fix", `${base}/fix`, "POST", { provider, auto: true });
  }, [autoFixEnabled, busy, project.build, project.autoFix, base, provider, run]);

  // ---------------------------------------------------------------- polling of long-running work
  const buildRunning = project.build !== null && project.build.status !== "completed";
  useEffect(() => {
    if (!buildRunning) return;
    const timer = setInterval(() => {
      api<{ project: ProjectView }>(`${base}/build`)
        .then((data) => setProject(data.project))
        .catch(() => undefined);
    }, 10_000);
    return () => clearInterval(timer);
  }, [buildRunning, base]);

  const deploying = project.deployment?.status === "deploying";
  useEffect(() => {
    if (!deploying) return;
    const timer = setInterval(() => {
      api<{ project: ProjectView }>(`${base}/cloud`)
        .then((data) => setProject(data.project))
        .catch(() => undefined);
    }, 8_000);
    return () => clearInterval(timer);
  }, [deploying, base]);

  const vpsBusy = project.vps !== null && (project.vps.status === "pending" || project.vps.status === "deploying");
  useEffect(() => {
    if (!vpsBusy) return;
    const timer = setInterval(() => {
      api<{ project: ProjectView }>(base)
        .then((data) => setProject(data.project))
        .catch(() => undefined);
    }, 10_000);
    return () => clearInterval(timer);
  }, [vpsBusy, base]);

  // ---------------------------------------------------------------- derived view
  const facts = workspaceFacts(project);
  const sections = useMemo(() => workspaceSections(project, busy !== null), [project, busy]);
  const next = nextAction(project, githubConnected);
  // The live preview disappears when the site is no longer deployed.
  const activeSection: SectionId = section === "preview" && !facts.previewUrl ? "overview" : section;
  const activeProvider = providers.find((item) => item.id === provider);

  const setAutoFix = (value: boolean) => {
    setAutoFixEnabled(value);
    try {
      window.localStorage.setItem("i2a_autofix", value ? "on" : "off");
    } catch {
      // storage unavailable: applies to this visit only
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Project bar */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <nav aria-label="مسیر صفحه" className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
            <Link href="/dashboard" className="hover:text-fg">
              پروژه‌ها
            </Link>
            <Icon name="chevron-left" size={13} />
            <span aria-current="page" className="truncate text-fg-2">
              {project.name}
            </span>
          </nav>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="page-title truncate">{project.name}</h1>
            <StatusBadge status={project.status} />
            <span className="badge">
              <Icon name={facts.isWebsite ? "globe" : "smartphone"} size={13} />
              {facts.isWebsite ? "وب‌سایت" : "اپ Android"}
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-1 xl:w-80">
          <label htmlFor="workspace-ai-provider" className="text-xs font-semibold text-muted">
            مدل هوش مصنوعی برای عملیات بعدی
          </label>
          <select
            id="workspace-ai-provider"
            className="input"
            value={provider}
            onChange={(event) => setProvider(event.target.value as ProviderInfo["id"])}
          >
            {providers.length === 0 && <option value={provider}>در حال بارگذاری…</option>}
            {providers.map((item) => (
              <option key={item.id} value={item.id} disabled={!item.available}>
                {item.label} — {item.model}
                {!item.available ? " (غیرفعال)" : ""}
              </option>
            ))}
          </select>
          {activeProvider && !activeProvider.available && (
            <span className="text-xs text-warning-fg">این مدل در دسترس نیست؛ در صفحهٔ اتصال‌ها کلید آن را وارد کنید.</span>
          )}
        </div>
      </div>

      <WorkspaceNav variant="tabs" sections={sections} active={activeSection} onSelect={go} />

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Side rail: section navigation and the assistant (stacks under the content on small screens). */}
        <div className="order-2 flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:order-none lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pb-2 scroll-thin">
          <div className="hidden lg:block">
            <WorkspaceNav variant="sidebar" sections={sections} active={activeSection} onSelect={go} />
          </div>
          <ActivityPanel
            project={project}
            busyMessage={busy ? BUSY_MESSAGES[busy] : null}
            next={next}
            onNavigate={go}
            canEdit={facts.hasCode}
            editDisabled={busy !== null}
            onEdit={(instruction) => runThen("build", "edit", `${base}/edit`, "POST", { instruction, provider })}
          />
        </div>

        <main id="workspace-content" className="order-1 flex min-w-0 flex-col gap-5 lg:order-none">
          {/* On small screens the assistant rail sits below the content, so the running operation is repeated here. */}
          {busy && (
            <div role="status" className="alert alert-brand lg:hidden">
              <span className="spinner mt-1" aria-hidden="true" />
              <span>{BUSY_MESSAGES[busy]}</span>
            </div>
          )}

          {error && !busy && (
            <div role="alert" className="alert alert-danger">
              <Icon name="alert-circle" className="mt-1" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">عملیات انجام نشد</div>
                {/* Provider and API errors are often English JSON: let the text pick its own direction. */}
                <p dir="auto" className="mt-1 max-h-40 overflow-auto text-xs leading-6 break-words whitespace-pre-wrap">
                  {error}
                </p>
              </div>
              <button type="button" className="btn-ghost btn-sm !min-h-7 !px-1.5 !text-danger-fg" onClick={() => setError(null)} aria-label="بستن پیام خطا">
                <Icon name="x" size={14} />
              </button>
            </div>
          )}

          {activeSection === "overview" && <OverviewSection project={project} sections={sections} next={next} onNavigate={go} />}

          {activeSection === "requirements" && (
            <RequirementsSection
              spec={project.spec}
              approved={facts.specApproved}
              disabled={busy !== null}
              onGenerate={(feedback) => run("spec", `${base}/spec`, "POST", { feedback, provider })}
              onApprove={(spec) => runThen("code", "approve", `${base}/spec`, "PUT", spec ? { spec } : {})}
            />
          )}

          {activeSection === "code" &&
            (facts.specApproved ? (
              <CodeSection project={project} disabled={busy !== null} onGenerate={() => run("code", `${base}/generate`, "POST", { provider })} />
            ) : (
              <LockedSection message="ابتدا نیازمندی‌ها را تأیید کنید؛ کد بر اساس آن‌ها ساخته می‌شود." onGo={() => go("requirements")} action="رفتن به نیازمندی‌ها" />
            ))}

          {activeSection === "preview" && facts.previewUrl && <PreviewSection url={facts.previewUrl} />}

          {activeSection === "build" &&
            (facts.hasCode ? (
              <BuildSection
                project={project}
                githubConnected={githubConnected}
                disabled={busy !== null}
                onPush={() => run("github", `${base}/github`, "POST")}
                onRebuild={() => run("rebuild", `${base}/build`, "POST")}
                onFix={() => run("fix", `${base}/fix`, "POST", { provider })}
                autoFix={{ enabled: autoFixEnabled, used: project.autoFix.used, max: project.autoFix.max, onChange: setAutoFix }}
              />
            ) : (
              <LockedSection message="ابتدا کد پروژه را تولید کنید." onGo={() => go("code")} action="رفتن به کد پروژه" />
            ))}

          {activeSection === "deploy" &&
            (project.hosting === "none" ? (
              facts.hasCode ? (
                <LocalDeploySection />
              ) : (
                <LockedSection message="ابتدا کد پروژه را تولید کنید." onGo={() => go("code")} action="رفتن به کد پروژه" />
              )
            ) : !project.repo ? (
              <LockedSection message="برای استقرار، ابتدا کد را به GitHub بفرستید." onGo={() => go("build")} action="رفتن به GitHub و Build" />
            ) : project.hosting === "vercel" ? (
              <CloudDeploySection project={project} disabled={busy !== null} onProvision={() => run("cloud", `${base}/cloud`, "POST")} />
            ) : (
              <VpsDeploySection
                project={project}
                disabled={busy !== null}
                onChange={setProject}
                onError={setError}
                onFix={() => run("fix", `${base}/fix`, "POST", { provider })}
                canFix={project.vps?.status === "error"}
              />
            ))}
        </main>

      </div>
    </div>
  );
}

function LockedSection({ message, action, onGo }: { message: string; action: string; onGo: () => void }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon name="lock" />
      </span>
      <p className="max-w-md text-sm leading-7">{message}</p>
      <button type="button" className="btn-secondary mt-1" onClick={onGo}>
        {action}
      </button>
    </div>
  );
}
