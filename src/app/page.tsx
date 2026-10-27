import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

const ERRORS: Record<string, string> = {
  oauth_state: "نشست ورود منقضی شد؛ دوباره تلاش کنید.",
  oauth_failed: "ورود با GitHub ناموفق بود؛ دوباره تلاش کنید.",
};

const STEPS = [
  { title: "ثبت ایده", text: "ایده‌ات را به فارسی یا انگلیسی بنویس." },
  { title: "تحلیل و تأیید", text: "هوش مصنوعی صفحات، داده‌ها و قابلیت‌ها را طراحی می‌کند و تو تأیید می‌کنی." },
  { title: "تولید کد", text: "کد کامل React + Capacitor یا React Native (Expo) ساخته می‌شود." },
  { title: "GitHub و APK", text: "Repository خصوصی ساخته می‌شود و GitHub Actions فایل APK را می‌سازد." },
  { title: "ابر (اختیاری)", text: "دیتابیس Neon و API روی Vercel برای اپ‌هایی که سرور لازم دارند." },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16">
      <section className="flex flex-col items-center gap-6 text-center">
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-700/30 dark:text-brand-100">
          OpenAI · Claude · Gemini
        </span>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
          ایده‌ات را بنویس،
          <br />
          <span className="text-brand-600">اپ اندروید تحویل بگیر</span>
        </h1>
        <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Idea2App AI نیازمندی‌ها را تحلیل می‌کند، کد اپ را می‌نویسد، آن را در GitHub تو ذخیره می‌کند و با GitHub
          Actions فایل APK قابل نصب می‌سازد.
        </p>
        {error && ERRORS[error] && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {ERRORS[error]}
          </p>
        )}
        <a href="/api/auth/github" className="btn-primary px-6 py-3 text-base">
          ورود با GitHub
        </a>
        <p className="text-xs text-slate-500">
          دسترسی درخواستی: ساخت Repository و اجرای Workflow در حساب خودت. رمز عبور تو هرگز دریافت نمی‌شود.
        </p>
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
