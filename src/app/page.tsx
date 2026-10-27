import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailLogin } from "@/components/EmailLogin";
import { enabledSocialProviders } from "@/lib/auth/providers";
import { getCurrentUser } from "@/lib/session";

const ERRORS: Record<string, string> = {
  oauth_state: "نشست ورود منقضی شد؛ دوباره تلاش کنید.",
  oauth_failed: "ورود ناموفق بود؛ دوباره تلاش کنید.",
  no_verified_email: "حساب شما ایمیل تأییدشده‌ای ندارد. ایمیلتان را در آن سرویس تأیید کنید یا با کد ایمیل وارد شوید.",
  account_conflict: "این ایمیل قبلاً به حساب دیگری از همین سرویس وصل شده است.",
  provider_disabled: "این روش ورود فعال نیست.",
};

const STEPS = [
  { title: "وب‌سایت یا اپ؟", text: "نوع محصول و این‌که روی گوشی بماند یا سرور لازم دارد را انتخاب می‌کنید." },
  { title: "تحلیل و تأیید", text: "هوش مصنوعی صفحات، داده‌ها و قابلیت‌ها را طراحی می‌کند و تو تأیید می‌کنی." },
  { title: "تولید کد", text: "کد کامل وب‌سایت، اپ React + Capacitor یا React Native (Expo) ساخته می‌شود." },
  { title: "GitHub و APK", text: "Repository خصوصی ساخته می‌شود و GitHub Actions فایل APK یا Build سایت را می‌سازد." },
  { title: "سرور", text: "VPS خودت با ایجنت خودکار، VPS رایگان، یا Vercel + Neon رایگان." },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-14">
      <section className="grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-5 text-center md:text-start">
          <span className="mx-auto w-fit rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 md:mx-0 dark:bg-brand-700/30 dark:text-brand-100">
            OpenAI · Claude · Gemini
          </span>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            ایده‌ات را بنویس،
            <br />
            <span className="text-brand-600">وب‌سایت یا اپ اندروید تحویل بگیر</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Idea2App AI نیازمندی‌ها را تحلیل می‌کند، کد را می‌نویسد، در GitHub خودت ذخیره می‌کند، APK می‌سازد و سایت
            یا سرور را روی VPS خودت یا یک سرویس رایگان راه می‌اندازد. هر مرحله آموزش تصویری دارد.
          </p>
          <p className="text-sm text-slate-500">
            طرح رایگان برای شروع کافی است ·{" "}
            <Link href="/pricing" className="text-brand-600 underline">
              مقایسه طرح‌ها
            </Link>
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          {error && ERRORS[error] && (
            <p className="w-full max-w-sm rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {ERRORS[error]}
            </p>
          )}
          <EmailLogin providers={enabledSocialProviders()} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, index) => (
          <div key={step.title} className="card">
            <div className="mb-2 text-sm font-bold text-brand-600">{(index + 1).toLocaleString("fa-IR")}</div>
            <h2 className="mb-1 font-bold">{step.title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{step.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
