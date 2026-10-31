// Display labels and tones for the real status values of projects, builds, deployments and VPS
// agents. Pure data (no server imports) so client and server components can share it.

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

export const TONE_BADGE: Record<Tone, string> = {
  neutral: "badge",
  brand: "badge badge-brand",
  success: "badge badge-success",
  warning: "badge badge-warning",
  danger: "badge badge-danger",
  info: "badge badge-info",
};

export const PROJECT_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "پیش‌نویس", tone: "neutral" },
  spec_ready: { label: "نیازمندی‌ها آماده", tone: "warning" },
  spec_approved: { label: "نیازمندی‌ها تأیید شد", tone: "info" },
  generating: { label: "در حال تولید", tone: "brand" },
  generated: { label: "کد آماده", tone: "brand" },
  pushed: { label: "در GitHub", tone: "success" },
  failed: { label: "خطا", tone: "danger" },
};

export function projectStatus(status: string) {
  return PROJECT_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
}

export interface BuildLike {
  status: string;
  conclusion: string | null;
}

export function buildStatus(build: BuildLike | null, isWebsite: boolean): { label: string; tone: Tone } {
  if (!build) return { label: "هنوز Build نشده", tone: "neutral" };
  if (build.status !== "completed") {
    const running: Record<string, string> = {
      waiting: "در انتظار شروع",
      queued: "در صف GitHub Actions",
      in_progress: isWebsite ? "در حال Build سایت" : "در حال ساخت APK",
    };
    return { label: running[build.status] ?? build.status, tone: "info" };
  }
  if (build.conclusion === "success") return { label: "Build موفق", tone: "success" };
  if (build.conclusion === "cancelled") return { label: "Build لغو شد", tone: "neutral" };
  return { label: "Build ناموفق", tone: "danger" };
}

export const DEPLOYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  provisioning: { label: "در حال آماده‌سازی", tone: "info" },
  deploying: { label: "در حال استقرار", tone: "info" },
  ready: { label: "منتشر شده", tone: "success" },
  failed: { label: "استقرار ناموفق", tone: "danger" },
};

export const VPS_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "منتظر نصب روی سرور", tone: "warning" },
  deploying: { label: "در حال استقرار", tone: "info" },
  online: { label: "فعال", tone: "success" },
  error: { label: "استقرار ناموفق", tone: "danger" },
};
