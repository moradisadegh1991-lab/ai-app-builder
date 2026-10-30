
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailLogin } from "@/components/EmailLogin";
import { enabledSocialProviders } from "@/lib/auth/providers";
import { getCurrentUser } from "@/lib/session";

const ERRORS: Record<string, string> = {
  oauth_state: "پاسخ ورود ناقص بود (کد بازگشتی نیامد)؛ دوباره تلاش کنید.",
  oauth_no_cookie:
    "مرورگر کوکی ورود را برنگرداند. ورود را از همین آدرس سایت شروع کنید (نه از آدرس Deployment یا Preview)، کوکی‌ها را مسدود نکرده باشید و دوباره تلاش کنید.",
  oauth_mismatch:
    "نشست ورود با پاسخ برنگشته یکی نبود (احتمالاً چند تب یا درخواست همزمان)؛ یک بار دیگر تلاش کنید.",
  provider_denied: "سرویس ورود درخواست را نپذیرفت یا لغو شد",
  oauth_failed: "ورود ناموفق بود",
  no_verified_email:
    "حساب شما ایمیل تأییدشده‌ای ندارد. ایمیلتان را در آن سرویس تأیید کنید یا با کد ایمیل وارد شوید.",
  account_conflict:
    "این ایمیل قبلاً به حساب دیگری از همین سرویس وصل شده است.",
  provider_disabled: "این روش ورود فعال نیست.",
};

const STEPS = [
  {
    number: "01",
    title: "ایده‌ات را توضیح بده",
    description:
      "کافی است به زبان ساده بگویی چه محصولی می‌خواهی؛ نیازی به دانش برنامه‌نویسی نیست.",
    icon: "✦",
  },
  {
    number: "02",
    title: "تحلیل و طراحی هوشمند",
    description:
      "هوش مصنوعی نیازمندی‌ها، صفحات، ساختار داده و قابلیت‌های محصول را آماده می‌کند.",
    icon: "⌘",
  },
  {
    number: "03",
    title: "تولید کد واقعی",
    description:
      "کد پروژه ساخته می‌شود و می‌توانی ساختار فایل‌ها و پیش‌نمایش محصول را بررسی کنی.",
    icon: "</>",
  },
  {
    number: "04",
    title: "ساخت و انتشار",
    description:
      "پروژه را در GitHub ذخیره کن و برای ساخت APK یا انتشار وب آماده شو.",
    icon: "↗",
  },
];

const FEATURES = [
  {
    title: "تولید کد با هوش مصنوعی",
    description: "تبدیل توضیحات متنی به ساختار واقعی یک نرم‌افزار",
    icon: "✧",
  },
  {
    title: "پشتیبانی از اپ و وب",
    description: "ساخت وب‌سایت و اپلیکیشن موبایل",
    icon: "▣",
  },
  {
    title: "اتصال به GitHub",
    description: "ذخیره و مدیریت کد در مخزن اختصاصی",
    icon: "⌘",
  },
  {
    title: "آماده‌سازی برای انتشار",
    description: "ساخت APK و آماده‌سازی نسخه وب",
    icon: "↗",
  },
];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[570px]">
      <div className="absolute -inset-8 rounded-[3rem] bg-indigo-400/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_30px_100px_-35px_rgba(49,46,129,0.35)]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">
              i
            </span>
            <span className="text-xs font-bold text-slate-800">
              Idea2App <span className="text-indigo-600">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-medium text-slate-500">
              Workspace
            </span>
          </div>
        </div>

        <div className="grid min-h-[340px] grid-cols-[116px_1fr] sm:grid-cols-[145px_1fr]">
          <aside className="border-e border-slate-100 bg-slate-50/80 p-3">
            <div className="mb-5 text-[9px] font-bold tracking-wider text-slate-400">
              PROJECT
            </div>

            <div className="mb-2 rounded-lg bg-indigo-50 px-2 py-2 text-[10px] font-bold text-indigo-700">
              ◈ Overview
            </div>

            <div className="space-y-3 px-2 py-2 text-[10px] text-slate-500">
              <div>▤ Requirements</div>
              <div>⌘ Code Explorer</div>
              <div>▣ Live Preview</div>
              <div>↗ Deployment</div>
            </div>

            <div className="mt-8 rounded-lg border border-slate-200 bg-white p-2">
              <div className="mb-2 text-[9px] font-bold text-slate-500">
                PROJECT STATUS
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-3/4 rounded-full bg-indigo-500" />
              </div>
              <div className="mt-1.5 text-[9px] text-slate-400">
                Ready to build
              </div>
            </div>
          </aside>

          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[9px] font-semibold text-indigo-600">
                  YOUR WORKSPACE
                </div>
                <h3 className="mt-1 text-sm font-extrabold text-slate-900 sm:text-base">
                  پروژه جدید من
                </h3>
                <p className="mt-1 text-[10px] text-slate-400">
                  از ایده تا محصول، در یک محیط واحد
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-600">
                ● Active
              </span>
            </div>

            <div className="mt-5 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-white text-sm text-indigo-600 shadow-sm">
                  ✦
                </span>
                <span className="text-[10px] font-bold text-slate-700">
                  AI Project Assistant
                </span>
              </div>
              <p className="mt-3 text-[10px] leading-6 text-slate-600 sm:text-xs">
                یک اپلیکیشن مدیریت وظایف با داشبورد، کاربران و گزارش‌های
                مدیریتی بساز.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-indigo-100 bg-white px-2 py-1 text-[9px] text-indigo-600">
                  React
                </span>
                <span className="rounded-md border border-indigo-100 bg-white px-2 py-1 text-[9px] text-indigo-600">
                  Mobile App
                </span>
                <span className="rounded-md border border-indigo-100 bg-white px-2 py-1 text-[9px] text-indigo-600">
                  AI Generated
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="text-[9px] text-slate-400">Generated files</div>
                <div className="mt-1 text-xl font-extrabold text-slate-800">
                  24
                </div>
                <div className="mt-1 text-[9px] text-emerald-600">
                  ✓ Project files
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="text-[9px] text-slate-400">Build status</div>
                <div className="mt-1 text-xl font-extrabold text-slate-800">
                  Ready
                </div>
                <div className="mt-1 text-[9px] text-emerald-600">
                  ✓ No active errors
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700">
                  Generation progress
                </span>
                <span className="text-[10px] font-bold text-indigo-600">
                  75%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-3/4 rounded-full bg-indigo-600" />
              </div>
              <div className="mt-2 text-[9px] text-slate-400">
                Preparing your application...
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3">
          <span className="text-[9px] text-slate-400">
            AI-powered application builder
          </span>
          <span className="text-[9px] font-semibold text-indigo-600">
            Idea2App AI
          </span>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-xl sm:flex">
        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          ✓
        </span>
        <span>
          <span className="block text-[10px] font-bold text-slate-800">
            کد پروژه آماده است
          </span>
          <span className="block text-[9px] text-slate-400">
            Ready for deployment
          </span>
        </span>
      </div>
    </div>
  );
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);

  if (user) {
    redirect("/dashboard");
  }

  const { error, detail } = await searchParams;

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      {/* Header */}
      <header className="relative z-10 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Idea2App AI"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-black text-white shadow-lg shadow-indigo-600/20">
              i
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-extrabold tracking-tight text-slate-950">
                Idea2App <span className="text-indigo-600">AI</span>
              </span>
              <span className="mt-1 text-[10px] font-medium text-slate-400">
                From idea to application
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-xs font-semibold text-slate-500 md:flex">
            <a href="#features" className="transition hover:text-indigo-600">
              امکانات
            </a>
            <a href="#how-it-works" className="transition hover:text-indigo-600">
              نحوه کار
            </a>
            <Link href="/pricing" className="transition hover:text-indigo-600">
              تعرفه‌ها
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="hidden rounded-xl px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:inline-flex"
            >
              مشاهده تعرفه‌ها
            </Link>
            <a
              href="#login"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700"
            >
              شروع رایگان
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-40 -top-40 size-[520px] rounded-full bg-indigo-100/60 blur-3xl" />
          <div className="absolute -bottom-48 -left-32 size-[480px] rounded-full bg-violet-100/50 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.18] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        </div>

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-indigo-700 shadow-sm">
              <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
              قدرت هوش مصنوعی در ساخت نرم‌افزار
            </div>

            <h1 className="mt-7 max-w-2xl text-4xl font-black leading-[1.55] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.45rem]">
              از یک ایده ساده،
              <br />
              تا یک محصول واقعی
              <span className="relative mt-1 block text-indigo-600">
                فقط با کمک هوش مصنوعی
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-sm leading-8 text-slate-600 sm:text-base sm:leading-9">
              ایده‌ات را توضیح بده؛ Idea2App AI به تو کمک می‌کند نیازمندی‌ها
              را تحلیل کنی، صفحات و قابلیت‌ها را طراحی کنی، کد واقعی بسازی و
              پروژه را برای انتشار آماده کنی.
            </p>

            <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <a
                href="#login"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:-translate-y-0.5 hover:bg-indigo-700 sm:w-auto"
              >
                ساخت اولین پروژه
                <span aria-hidden="true">←</span>
              </a>

              <a
                href="#how-it-works"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 sm:w-auto"
              >
                آشنایی با نحوه کار
                <span aria-hidden="true">⌄</span>
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-slate-500 lg:justify-start">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span>
                شروع با طرح رایگان
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span>
                بدون نیاز به دانش کدنویسی
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span>
                کنترل کد و پروژه
              </span>
            </div>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <span className="text-[10px] font-semibold text-slate-400">
                AI PROVIDERS
              </span>
              {["OpenAI", "Claude", "Gemini"].map((provider) => (
                <span
                  key={provider}
                  className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-[10px] font-bold text-slate-600"
                >
                  {provider}
                </span>
              ))}
            </div>
          </div>

          <div className="relative px-1 py-4 sm:px-5 lg:px-0">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Login */}
      <section
        id="login"
        className="scroll-mt-24 border-y border-slate-100 bg-slate-50/80 py-16 sm:py-20"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <div>
            <span className="text-[11px] font-extrabold tracking-widest text-indigo-600">
              GET STARTED
            </span>
            <h2 className="mt-3 text-2xl font-black leading-relaxed text-slate-950 sm:text-3xl">
              آماده‌ای ایده‌ات را
              <span className="text-indigo-600"> به محصول تبدیل کنی؟</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-8 text-slate-500">
              وارد حساب کاربری شو یا ثبت‌نام کن. بعد از ورود می‌توانی پروژه
              جدید بسازی، تنظیمات هوش مصنوعی را انجام بدهی و وارد محیط
              توسعه محصول شوی.
            </p>

            <div className="mt-7 grid max-w-lg grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-lg text-indigo-600">✦</div>
                <div className="mt-2 text-xs font-bold text-slate-800">
                  دستیار هوشمند
                </div>
                <p className="mt-1 text-[10px] leading-5 text-slate-400">
                  همراه در تحلیل و ساخت پروژه
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-lg text-indigo-600">⌘</div>
                <div className="mt-2 text-xs font-bold text-slate-800">
                  محیط توسعه یکپارچه
                </div>
                <p className="mt-1 text-[10px] leading-5 text-slate-400">
                  کد، پیش‌نمایش و انتشار
                </p>
              </div>
            </div>
          </div>

          <div className="w-full">
            {error && ERRORS[error] && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700"
              >
                {ERRORS[error]}
                {(error === "provider_denied" || error === "oauth_failed") &&
                  detail &&
                  /^[a-z0-9_]{1,60}$/.test(detail) && (
                    <>
                      {" "}
                      (<span dir="ltr">{detail}</span>)
                    </>
                  )}
              </div>
            )}

            <EmailLogin providers={enabledSocialProviders()} />

            <p className="mt-3 text-center text-[10px] leading-6 text-slate-400">
              با ورود یا ثبت‌نام، استفاده از سرویس را می‌پذیرید.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[11px] font-extrabold tracking-widest text-indigo-600">
            PLATFORM FEATURES
          </span>
          <h2 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
            ابزارهای لازم برای ساخت محصول
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-500">
            از تعریف ایده تا تولید کد و آماده‌سازی برای انتشار، همه‌چیز در
            یک جریان کاری منسجم قرار می‌گیرد.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-950/5"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                {feature.icon}
              </div>
              <div className="mt-5 text-[10px] font-bold text-indigo-500">
                FEATURE 0{index + 1}
              </div>
              <h3 className="mt-2 text-sm font-extrabold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-xs leading-7 text-slate-500">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section
        id="how-it-works"
        className="scroll-mt-24 border-y border-slate-100 bg-slate-50 py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-[11px] font-extrabold tracking-widest text-indigo-600">
              HOW IT WORKS
            </span>
            <h2 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
              مسیر ساخت محصول، مرحله به مرحله
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-500">
              فرآیند ساخت پروژه را مدیریت کن و در هر مرحله نتیجه را بررسی
              و تأیید کن.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <article
                key={step.number}
                className="relative rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600">
                    {step.icon}
                  </span>
                  <span className="font-mono text-2xl font-black text-slate-100">
                    {step.number}
                  </span>
                </div>

                <h3 className="mt-6 text-sm font-extrabold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-xs leading-7 text-slate-500">
                  {step.description}
                </p>

                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -left-3 top-10 z-10 hidden size-6 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-indigo-500 lg:flex"
                  >
                    ←
                  </span>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-950 px-6 py-10 text-center sm:px-12 sm:py-14">
          <span className="text-[10px] font-extrabold tracking-[0.2em] text-indigo-300">
            BUILD YOUR WAY
          </span>
          <h2 className="mt-4 text-2xl font-black leading-relaxed text-white sm:text-3xl">
            انتخاب فناوری و مسیر انتشار در اختیار توست
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-xs leading-8 text-slate-400 sm:text-sm">
            بر اساس نوع محصول، می‌توانی مسیر توسعه وب یا اپلیکیشن موبایل را
            انتخاب کنی و از ابزارهای متناسب با پروژه استفاده کنی.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {["React", "Capacitor", "React Native", "GitHub", "Vercel", "VPS"].map(
              (technology) => (
                <span
                  key={technology}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold text-slate-200"
                >
                  {technology}
                </span>
              ),
            )}
          </div>

          <a
            href="#login"
            className="mt-9 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-sm font-extrabold text-slate-950 transition hover:bg-indigo-50"
          >
            شروع ساخت پروژه
            <span aria-hidden="true">←</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-7 text-center sm:flex-row sm:px-6 sm:text-right lg:px-8">
          <Link href="/" className="text-sm font-extrabold text-slate-900">
            Idea2App <span className="text-indigo-600">AI</span>
          </Link>

          <p className="text-[10px] text-slate-400">
            از ایده تا اپلیکیشن، با کمک هوش مصنوعی
          </p>

          <Link
            href="/pricing"
            className="text-xs font-semibold text-slate-500 transition hover:text-indigo-600"
          >
            تعرفه‌ها و طرح‌ها
          </Link>
        </div>
      </footer>
    </main>
  );
}
