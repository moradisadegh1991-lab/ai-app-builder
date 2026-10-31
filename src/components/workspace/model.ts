import type { ProjectView } from "@/lib/projects";
import type { IconName } from "../ui/Icon";

// Derives the workspace navigation, step states and the suggested next action from the real
// project view. Pure functions: no fetching, no invented data.

export type SectionId = "overview" | "requirements" | "code" | "preview" | "build" | "deploy";

export type StepState = "done" | "current" | "todo" | "locked" | "error" | "running";

export interface WorkspaceSection {
  id: SectionId;
  label: string;
  icon: IconName;
  state: StepState;
  /** Short status line shown under the label in the navigation. */
  hint: string;
}

/**
 * Where a deployment really is. Vercel and VPS keep their own vocabularies:
 *  - Vercel: idle -> provisioning (database + project being created) -> deploying (Vercel build) -> ready | failed
 *  - VPS:    idle -> waiting (installer not run yet) -> deploying -> ready | failed
 *  - device: ready once the APK build succeeded.
 */
export type DeployPhase = "idle" | "provisioning" | "deploying" | "waiting" | "ready" | "failed";

export interface DeployInfo {
  target: "device" | "vercel" | "vps";
  phase: DeployPhase;
  /** Short status, e.g. for badges and the navigation hint. */
  label: string;
  /** One sentence about what is happening now, from real data only. */
  description: string;
  /** Ready, but something needs attention (a VPS agent that stopped reporting). */
  attention?: boolean;
}

export interface WorkspaceFacts {
  specApproved: boolean;
  hasCode: boolean;
  isWebsite: boolean;
  buildRunning: boolean;
  buildSucceeded: boolean;
  buildFailed: boolean;
  deploy: DeployInfo;
  deployRunning: boolean;
  deployReady: boolean;
  deployFailed: boolean;
  /** Deployed website URL when the website is live on Vercel or a VPS. */
  previewUrl: string | null;
}

function safeUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//.test(url) ? url : null;
}

export function deployInfo(project: ProjectView): DeployInfo {
  if (project.hosting === "vercel") {
    const d = project.deployment;
    const needsBackend = Boolean(project.spec?.needsBackend);
    if (!d) return { target: "vercel", phase: "idle", label: "آماده استقرار", description: "هنوز استقراری برای این پروژه ثبت نشده است." };
    switch (d.status) {
      case "provisioning":
        return {
          target: "vercel",
          phase: "provisioning",
          label: "در حال آماده‌سازی",
          description: `${needsBackend ? "دیتابیس Neon و پروژهٔ Vercel" : "پروژهٔ Vercel"} در حال ساخته شدن است؛ هنوز استقرار شروع نشده است.`,
        };
      case "deploying":
        return { target: "vercel", phase: "deploying", label: "در حال استقرار", description: "Vercel در حال Build و انتشار است؛ نشانی پس از آماده شدن نمایش داده می‌شود." };
      case "ready":
        return {
          target: "vercel",
          phase: "ready",
          label: "منتشر شده",
          description: safeUrl(d.url) ? "سایت روی Vercel منتشر شده و در دسترس است." : "استقرار تمام شده اما نشانی معتبری ثبت نشده است.",
        };
      case "failed":
        return { target: "vercel", phase: "failed", label: "استقرار ناموفق", description: "ساخت زیرساخت یا استقرار با خطا متوقف شد؛ پیام خطا را بخوانید و دوباره تلاش کنید." };
      default:
        return { target: "vercel", phase: "idle", label: d.status, description: "" };
    }
  }

  if (project.hosting === "vps") {
    const v = project.vps;
    if (!v) return { target: "vps", phase: "idle", label: "سروری متصل نیست", description: "دستور نصب را بسازید و روی سرور اجرا کنید." };
    if (!v.registered || v.status === "pending") {
      return { target: "vps", phase: "waiting", label: "منتظر نصب روی سرور", description: "دستور نصب را روی سرور اجرا کنید؛ این صفحه خودکار به‌روز می‌شود." };
    }
    if (v.status === "deploying") return { target: "vps", phase: "deploying", label: "در حال استقرار روی سرور", description: "ایجنت در حال دریافت، Build و راه‌اندازی آخرین نسخه است." };
    if (v.status === "online") {
      return v.stale
        ? { target: "vps", phase: "ready", label: "فعال، بدون گزارش اخیر", description: "ایجنت بیش از ۱۰ دقیقه گزارشی نفرستاده؛ ممکن است سرور خاموش یا بدون اینترنت باشد.", attention: true }
        : { target: "vps", phase: "ready", label: "فعال", description: "سایت روی سرور شما در دسترس است." };
    }
    if (v.status === "error") return { target: "vps", phase: "failed", label: "استقرار ناموفق", description: "استقرار روی سرور با خطا متوقف شد؛ گزارش را ببینید یا اصلاح خودکار را اجرا کنید." };
    return { target: "vps", phase: "idle", label: v.status, description: "" };
  }

  const built = project.build?.status === "completed" && project.build.conclusion === "success";
  return built
    ? { target: "device", phase: "ready", label: "آماده نصب", description: "فایل APK ساخته شده و آمادهٔ دانلود است." }
    : { target: "device", phase: "idle", label: "اجرا روی گوشی", description: "پس از موفق شدن Build، APK قابل دانلود می‌شود." };
}

export function workspaceFacts(project: ProjectView): WorkspaceFacts {
  const build = project.build;
  const deployment = project.deployment;
  const vps = project.vps;
  const isWebsite = project.kind === "website";

  const buildRunning = Boolean(build && build.status !== "completed");
  const buildSucceeded = build?.status === "completed" && build.conclusion === "success";
  const buildFailed = build?.status === "completed" && build.conclusion === "failure";

  const deploy = deployInfo(project);
  const deployRunning = deploy.phase === "provisioning" || deploy.phase === "deploying";
  const deployReady = deploy.phase === "ready";
  const deployFailed = deploy.phase === "failed";
  // A URL is offered only once the deployment really is ready; never while it is still being built.
  const liveUrl = project.hosting === "vercel" ? (deployReady ? safeUrl(deployment?.url) : null) : project.hosting === "vps" ? (deployReady ? safeUrl(vps?.url) : null) : null;

  return {
    specApproved: Boolean(project.specApprovedAt),
    hasCode: Boolean(project.generation?.files.length) && project.generation?.kind !== "spec",
    isWebsite,
    buildRunning,
    buildSucceeded,
    buildFailed,
    deploy,
    deployRunning,
    deployReady,
    deployFailed,
    previewUrl: isWebsite ? liveUrl : null,
  };
}

/** Where the user should be now: the first unfinished step of the lifecycle. */
export function currentSection(project: ProjectView, facts = workspaceFacts(project)): SectionId {
  if (!facts.specApproved) return "requirements";
  if (!facts.hasCode) return "code";
  if (!facts.buildSucceeded || project.status !== "pushed") return "build";
  if (project.hosting !== "none" && !facts.deployReady) return "deploy";
  return "overview";
}

export function deployLabel(project: ProjectView) {
  if (project.hosting === "none") return "اجرا روی گوشی";
  if (project.hosting === "vercel") return "Vercel + Neon";
  return project.vpsProvider === "own" ? "VPS شخصی" : "VPS رایگان";
}

export function workspaceSections(project: ProjectView, busy: boolean): WorkspaceSection[] {
  const f = workspaceFacts(project);
  const generating = project.status === "generating" || busy;
  const current = currentSection(project, f);
  const mark = (id: SectionId, done: boolean, locked: boolean, error = false, running = false): StepState => {
    if (error) return "error";
    if (running) return "running";
    if (done) return "done";
    if (locked) return "locked";
    return id === current ? "current" : "todo";
  };

  const sections: WorkspaceSection[] = [
    { id: "overview", label: "نمای کلی", icon: "grid", state: "todo", hint: "خلاصه و اقدام بعدی" },
    {
      id: "requirements",
      label: "نیازمندی‌ها",
      icon: "list",
      state: mark("requirements", f.specApproved, false, false, generating && !project.spec),
      hint: f.specApproved ? "تأیید شده" : project.spec ? "منتظر تأیید" : "تحلیل نشده",
    },
    {
      id: "code",
      label: "کد پروژه",
      icon: "code",
      state: mark("code", f.hasCode, !f.specApproved, false, generating && f.specApproved && !f.hasCode),
      hint: f.hasCode ? `${(project.generation?.files.length ?? 0).toLocaleString("fa-IR")} فایل` : f.specApproved ? "آماده تولید" : "قفل",
    },
  ];

  if (f.previewUrl) {
    sections.push({ id: "preview", label: "پیش‌نمایش زنده", icon: "eye", state: "done", hint: "نسخه منتشرشده" });
  }

  sections.push(
    {
      id: "build",
      label: f.isWebsite ? "GitHub و Build" : "GitHub و APK",
      icon: "git-branch",
      state: mark("build", f.buildSucceeded && project.status === "pushed", !f.hasCode, f.buildFailed, f.buildRunning),
      hint: project.build
        ? f.buildRunning
          ? "در حال اجرا"
          : f.buildSucceeded
            ? "Build موفق"
            : f.buildFailed
              ? "Build ناموفق"
              : "پایان یافت"
        : project.repo
          ? "در GitHub"
          : f.hasCode
            ? "آماده ارسال"
            : "قفل",
    },
    {
      id: "deploy",
      label: "استقرار",
      icon: project.hosting === "none" ? "smartphone" : project.hosting === "vercel" ? "cloud" : "server",
      state:
        project.hosting === "none"
          ? mark("deploy", f.buildSucceeded, !f.hasCode)
          : mark("deploy", f.deployReady, !project.repo, f.deployFailed, f.deployRunning),
      hint: f.deploy.phase === "idle" ? deployLabel(project) : f.deploy.label,
    },
  );

  return sections;
}

export interface NextAction {
  title: string;
  description: string;
  section: SectionId;
  /** Work is in progress on the server (build, provisioning, deployment): the UI shows a spinner. */
  running?: boolean;
}

/** One concrete suggestion derived from the lifecycle, shown in the activity panel and overview. */
export function nextAction(project: ProjectView, githubConnected: boolean): NextAction {
  const f = workspaceFacts(project);
  const product = f.isWebsite ? "سایت" : "اپ";
  if (!project.spec) {
    return { title: "تحلیل ایده", description: "هوش مصنوعی ایده را به صفحات، قابلیت‌ها و مدل داده تبدیل می‌کند.", section: "requirements" };
  }
  if (!f.specApproved) {
    return { title: "بررسی و تأیید نیازمندی‌ها", description: "قبل از تولید کد، نیازمندی‌ها را بخوانید و در صورت نیاز اصلاح کنید.", section: "requirements" };
  }
  if (!f.hasCode) {
    return { title: `تولید کد ${product}`, description: "کد کامل پروژه بر اساس نیازمندی‌های تأییدشده ساخته می‌شود.", section: "code" };
  }
  if (!githubConnected) {
    return { title: "اتصال GitHub", description: "کد در یک مخزن خصوصی در حساب شما ذخیره و همان‌جا Build می‌شود.", section: "build" };
  }
  if (f.buildRunning) {
    return { title: "Build در حال اجراست", description: "وضعیت هر چند ثانیه خودکار به‌روز می‌شود.", section: "build", running: true };
  }
  if (f.buildFailed) {
    return { title: "اصلاح خطای Build", description: "گزارش خطا را به هوش مصنوعی بدهید تا کد را اصلاح و دوباره Build کند.", section: "build" };
  }
  if (project.status !== "pushed") {
    return { title: project.repo ? "ارسال نسخه جدید به GitHub" : "ساخت مخزن و شروع Build", description: "آخرین نسخه کد هنوز در GitHub ثبت نشده است.", section: "build" };
  }
  if (!f.buildSucceeded) {
    return { title: "Build در انتظار", description: "Build برای آخرین Commit هنوز گزارش نشده است.", section: "build" };
  }
  if (project.hosting === "none") {
    return { title: "نصب APK روی گوشی", description: "فایل APK آماده دانلود است.", section: "build" };
  }
  switch (f.deploy.phase) {
    case "failed":
      return f.deploy.target === "vps"
        ? { title: "بررسی خطای استقرار", description: "گزارش استقرار را ببینید یا اصلاح خودکار را اجرا کنید.", section: "deploy" }
        : { title: "بررسی خطای استقرار", description: "پیام خطا را در بخش استقرار بخوانید، تنظیمات Vercel و Neon را بررسی کنید و دوباره تلاش کنید.", section: "deploy" };
    case "provisioning":
      return { title: "آماده‌سازی زیرساخت در حال انجام است", description: f.deploy.description, section: "deploy", running: true };
    case "deploying":
      return { title: "استقرار در حال انجام است", description: f.deploy.description, section: "deploy", running: true };
    case "waiting":
      return { title: "نصب ایجنت روی سرور", description: f.deploy.description, section: "deploy" };
    case "idle":
      return { title: `انتشار ${product}`, description: `${deployLabel(project)} را راه‌اندازی کنید.`, section: "deploy" };
    default:
      break;
  }
  // An agent that stopped reporting is not announced as a healthy, published site.
  if (f.deploy.attention) {
    return { title: "بررسی وضعیت سرور", description: f.deploy.description, section: "deploy" };
  }
  // "Ready" without a usable address must not be announced as a live site.
  if (f.isWebsite && f.deploy.target !== "device" && !f.previewUrl) {
    return { title: "استقرار تمام شد", description: f.deploy.description, section: "deploy" };
  }
  return {
    title: `${product} منتشر شده است`,
    description: "برای تغییرات بعدی از «ویرایش با هوش مصنوعی» استفاده کنید.",
    section: f.previewUrl ? "preview" : "overview",
  };
}
