import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailLogin } from "@/components/EmailLogin";
import { PublicHeader } from "@/components/PublicHeader";
import { Brand } from "@/components/ui/Brand";
import { Icon, type IconName } from "@/components/ui/Icon";
import { enabledSocialProviders } from "@/lib/auth/providers";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { turnstileEnabled } from "@/lib/turnstile";

const ERRORS: Record<string, string> = {
  oauth_state: "پاسخ ورود ناقص بود (کد بازگشتی نیامد)؛ دوباره تلاش کنید.",
  oauth_no_cookie:
    "مرورگر کوکی ورود را برنگرداند. ورود را از همین آدرس سایت شروع کنید (نه از آدرس Deployment یا Preview)، کوکی‌ها را مسدود نکرده باشید و دوباره تلاش کنید.",
  oauth_mismatch: "نشست ورود با پاسخ برنگشته یکی نبود (احتمالاً چند تب یا درخواست همزمان)؛ یک بار دیگر تلاش کنید.",
  provider_denied: "سرویس ورود درخواست را نپذیرفت یا لغو شد",
  oauth_failed: "ورود ناموفق بود",
  no_verified_email: "حساب شما ایمیل تأییدشده‌ای ندارد. ایمیلتان را در آن سرویس تأیید کنید یا با کد ایمیل وارد شوید.",
  account_conflict: "این ایمیل قبلاً به حساب دیگری از همین سرویس وصل شده است.",
  provider_disabled: "این روش ورود فعال نیست.",
  rate_limited: "تعداد تلاش‌ها زیاد بود؛ چند دقیقه صبر کنید و دوباره امتحان کنید.",
};

const STEPS: { title: string; text: string; icon: IconName }[] = [
  { title: "ایده را بنویس", text: "به زبان ساده توضیح بده چه می‌خواهی؛ اسکرین‌شات یا فایل هم پیوست کن.", icon: "pencil" },
  { title: "نیازمندی‌ها را تأیید کن", text: "هوش مصنوعی صفحات، قابلیت‌ها و مدل داده را می‌نویسد و تو بررسی می‌کنی.", icon: "list" },
  { title: "کد کامل تولید می‌شود", text: "وب‌سایت React یا اپ Android با Capacitor یا Expo، با فونت و تاریخ فارسی.", icon: "code" },
  { title: "Build در GitHub خودت", text: "مخزن خصوصی ساخته می‌شود و GitHub Actions فایل APK یا Build سایت را می‌سازد.", icon: "git-branch" },
  { title: "انتشار", text: "روی VPS خودت با ایجنت خودکار، VPS رایگان، یا Vercel + Neon.", icon: "rocket" },
];

const FEATURES: { title: string; text: string; icon: IconName }[] = [
  { title: "OpenAI، Claude و Gemini", text: "مدل را برای هر مرحله انتخاب کن؛ با کلید خودت یا اعتبار پلتفرم.", icon: "sparkles" },
  { title: "اصلاح خودکار خطا", text: "اگر Build شکست بخورد، گزارش خطا به مدل داده می‌شود و کد اصلاح‌شده دوباره ساخته می‌شود.", icon: "hammer" },
  { title: "ویرایش با گفتگو", text: "تغییر را بنویس؛ فقط فایل‌های لازم عوض می‌شوند و نسخهٔ جدید منتشر می‌شود.", icon: "pencil" },
  { title: "کد مال توست", text: "همه‌چیز در مخزن خصوصی GitHub خودت ذخیره می‌شود؛ قفل پلتفرم نیستی.", icon: "shield" },
  { title: "آموزش تصویری", text: "برای هر مرحله، از ساخت VPS رایگان تا نصب APK، راهنمای قدم‌به‌قدم داری.", icon: "book" },
  { title: "مناسب کاربر فارسی‌زبان", text: "راست‌به‌چپ، فونت وزیرمتن، تاریخ شمسی و قیمت تومانی در خروجی.", icon: "globe" },
];

/** A schematic of the workspace (labels only, no numbers) to show what the product looks like. */
function WorkspaceSketch() {
  const rows: { label: string; icon: IconName; state: "done" | "current" | "todo" }[] = [
    { label: "نیازمندی‌ها", icon: "list", state: "done" },
    { label: "کد پروژه", icon: "code", state: "done" },
    { label: "GitHub و Build", icon: "git-branch", state: "current" },
    { label: "استقرار", icon: "rocket", state: "todo" },
  ];
  return (
    <div className="panel overflow-hidden shadow-pop" aria-hidden="true">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ms-3 text-xs font-semibold text-muted">فضای کاری پروژه</span>
      </div>
      <div className="grid grid-cols-[9.5rem_1fr]">
        <div className="flex flex-col gap-1 border-e border-line bg-surface-2 p-2.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium ${
                row.state === "current" ? "bg-surface text-fg shadow-xs ring-1 ring-line" : "text-muted"
              }`}
            >
              <span
                className={`grid size-4 place-items-center rounded-full ${
                  row.state === "done" ? "bg-success text-white" : row.state === "current" ? "bg-primary text-primary-fg" : "border border-line-strong"
                }`}
              >
                {row.state === "done" && <Icon name="check" size={9} strokeWidth={3} />}
              </span>
              {row.label}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="h-2.5 w-32 rounded bg-surface-3" />
          <div className="rounded-lg bg-code-bg p-3">
            {[72, 56, 88, 40, 64].map((width, index) => (
              <div key={index} className="mb-1.5 flex gap-2 last:mb-0">
                <span className="h-1.5 w-3 rounded bg-white/15" />
                <span className="h-1.5 rounded bg-white/25" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-success-line bg-success-soft px-3 py-2 text-[11px] font-medium text-success-fg">
            <Icon name="check-circle" size={14} />
            Build موفق — APK آماده دانلود
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ error?: string; detail?: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/dashboard");
  const { error, detail } = await searchParams;

  return (
    <>
      <PublicHeader />

      <main>
        <section className="page-container grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:py-16">
          <div className="flex flex-col gap-6">
            <span className="badge badge-brand self-start">
              <Icon name="sparkles" size={13} />
              OpenAI · Claude · Gemini
            </span>
            <h1 className="text-3xl leading-[1.45] font-extrabold tracking-tight text-fg sm:text-4xl lg:text-[2.75rem]">
              ایده‌ات را بنویس،
              <br />
              <span className="text-primary">وب‌سایت یا اپ Android تحویل بگیر</span>
            </h1>
            <p className="max-w-xl text-base leading-8 text-fg-2">
              Idea2App AI نیازمندی‌ها را تحلیل می‌کند، کد را می‌نویسد، در GitHub خودت ذخیره می‌کند، APK می‌سازد و سایت یا سرور را روی VPS خودت یا یک
              سرویس رایگان منتشر می‌کند.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#login" className="btn-primary btn-lg">
                شروع رایگان
                <Icon name="arrow-left" size={16} />
              </a>
              <Link href="/pricing" className="btn-secondary btn-lg">
                مقایسهٔ طرح‌ها
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {["طرح رایگان برای شروع", "کد در GitHub خودت", "بدون نیاز به برنامه‌نویسی"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Icon name="check" size={15} className="text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div id="login" className="flex scroll-mt-24 flex-col gap-3 lg:ps-6">
            {error && ERRORS[error] && (
              <div role="alert" className="alert alert-danger">
                <Icon name="alert-circle" className="mt-1" />
                <span>
                  {ERRORS[error]}
                  {(error === "provider_denied" || error === "oauth_failed") && detail && /^[a-z0-9_]{1,60}$/.test(detail) && (
                    <>
                      {" "}
                      (<span dir="ltr">{detail}</span>)
                    </>
                  )}
                </span>
              </div>
            )}
            <EmailLogin providers={enabledSocialProviders()} turnstileSiteKey={turnstileEnabled() ? env.turnstileSiteKey() : undefined} />
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="page-container grid items-center gap-10 py-14 lg:grid-cols-2">
            <WorkspaceSketch />
            <div id="how" className="scroll-mt-24">
              <div className="eyebrow">روند کار</div>
              <h2 className="mt-2 text-2xl font-bold text-fg">از ایده تا نسخهٔ قابل اجرا، در یک فضای کاری</h2>
              <ol className="mt-6 flex flex-col gap-4">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-fg">
                      <Icon name={step.icon} size={17} />
                    </span>
                    <div>
                      <div className="font-semibold text-fg">
                        <span className="text-faint">{(index + 1).toLocaleString("fa-IR")}. </span>
                        {step.title}
                      </div>
                      <p className="mt-0.5 text-sm leading-7 text-muted">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="page-container py-14">
          <h2 className="text-2xl font-bold text-fg">امکانات</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card">
                <span className="grid size-9 place-items-center rounded-lg bg-surface-3 text-fg-2">
                  <Icon name={feature.icon} size={18} />
                </span>
                <h3 className="mt-3 font-semibold text-fg">{feature.title}</h3>
                <p className="mt-1 text-sm leading-7 text-muted">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="page-container flex flex-col items-center justify-between gap-3 py-6 text-sm text-muted sm:flex-row">
          <Brand />
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-fg">
              طرح‌ها
            </Link>
            <a href="#login" className="hover:text-fg">
              ورود
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
