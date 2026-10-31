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

export interface WorkspaceFacts {
  specApproved: boolean;
  hasCode: boolean;
  isWebsite: boolean;
  buildRunning: boolean;
  buildSucceeded: boolean;
  buildFailed: boolean;
  deployRunning: boolean;
  deployReady: boolean;
  deployFailed: boolean;
  /** Deployed website URL when the website is live on Vercel or a VPS. */
  previewUrl: string | null;
}

function safeUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//.test(url) ? url : null;
}

export function workspaceFacts(project: ProjectView): WorkspaceFacts {
  const build = project.build;
  const deployment = project.deployment;
  const vps = project.vps;
  const isWebsite = project.kind === "website";

  const buildRunning = Boolean(build && build.status !== "completed");
  const buildSucceeded = build?.status === "completed" && build.conclusion === "success";
  const buildFailed = build?.status === "completed" && build.conclusion === "failure";

  let deployRunning = false;
  let deployReady = false;
  let deployFailed = false;
  let liveUrl: string | null = null;
  if (project.hosting === "vercel") {
    deployRunning = deployment?.status === "provisioning" || deployment?.status === "deploying";
    deployReady = deployment?.status === "ready";
    deployFailed = deployment?.status === "failed";
    liveUrl = deployReady ? safeUrl(deployment?.url) : null;
  } else if (project.hosting === "vps") {
    deployRunning = vps?.status === "deploying";
    deployReady = vps?.status === "online";
    deployFailed = vps?.status === "error";
    liveUrl = deployReady ? safeUrl(vps?.url) : null;
  } else {
    deployReady = buildSucceeded;
  }

  return {
    specApproved: Boolean(project.specApprovedAt),
    hasCode: Boolean(project.generation?.files.length) && project.generation?.kind !== "spec",
    isWebsite,
    buildRunning,
    buildSucceeded,
    buildFailed,
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
      hint: deployLabel(project),
    },
  );

  return sections;
}

export interface NextAction {
  title: string;
  description: string;
  section: SectionId;
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
    return { title: "Build در حال اجراست", description: "وضعیت هر چند ثانیه خودکار به‌روز می‌شود.", section: "build" };
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
  if (f.deployFailed) {
    return { title: "بررسی خطای استقرار", description: "گزارش استقرار را ببینید یا اصلاح خودکار را اجرا کنید.", section: "deploy" };
  }
  if (f.deployRunning) {
    return { title: "استقرار در حال انجام است", description: "وضعیت به‌صورت خودکار به‌روز می‌شود.", section: "deploy" };
  }
  if (!f.deployReady) {
    return { title: `انتشار ${product}`, description: `${deployLabel(project)} را راه‌اندازی کنید.`, section: "deploy" };
  }
  return {
    title: `${product} منتشر شده است`,
    description: "برای تغییرات بعدی از «ویرایش با هوش مصنوعی» استفاده کنید.",
    section: f.previewUrl ? "preview" : "overview",
  };
}
