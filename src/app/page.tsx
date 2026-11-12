import Link from "next/link";
import { redirect } from "next/navigation";
import { IdeaStarter } from "@/components/IdeaStarter";
import { ProductPreview } from "@/components/ProductPreview";
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

const SPECIALISTS: { name: string; description: string; icon: IconName; number: string }[] = [
  {
    name: "معمار محصول",
    description: "ایده را به نقشهٔ راه، صفحات و نیازمندی‌های روشن تبدیل می‌کند.",
    icon: "layers",
    number: "۰۱",
  },
  {
    name: "طراح تجربه",
    description: "برای هر صفحه، ظاهر، جریان کار و حالت‌های مختلف را طراحی می‌کند.",
    icon: "pencil",
    number: "۰۲",
  },
  {
    name: "متخصص فرانت‌اند",
    description: "رابطی واکنش‌گرا می‌سازد که روی موبایل و دسکتاپ کار کند.",
    icon: "monitor",
    number: "۰۳",
  },
  {
    name: "متخصص بک‌اند",
    description: "API، منطق سرور و ارتباط با دیتابیس را پیاده می‌کند.",
    icon: "database",
    number: "۰۴",
  },
  {
    name: "ارزیاب کیفیت",
    description: "کد و شواهد تست را با نیازمندی‌های تأییدشده تطبیق می‌دهد.",
    icon: "shield",
    number: "۰۵",
  },
  {
    name: "متخصص خطایابی",
    description: "گزارش خطا را بررسی می‌کند و اصلاحات را برای تست دوباره می‌فرستد.",
    icon: "hammer",
    number: "۰۶",
  },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/dashboard");
  const { error, detail } = await searchParams;
  return (
    <div className="landing-page">
      <PublicHeader />
      <main id="main-content">
        <section className="landing-hero page-container">
          <div className="hero-announcement">
            <span className="status-dot" />
            <span>یک تیم هوش مصنوعی، برای ایدهٔ بعدی تو</span>
            <Icon name="sparkles" size={14} />
          </div>
          <h1>
            فقط یک ایده فاصله داری
            <br />
            تا <span className="hero-accent">ساختنِ چیزی تازه.</span>
          </h1>
          <p className="hero-description">
            وب‌سایت یا اپلیکیشنی که در ذهن داری، با تیمی از ایجنت‌های متخصص بساز.
            <br className="hidden sm:block" /> از اولین جمله تا طراحی، کدنویسی و انتشار؛ همه در یک فضای کاری.
          </p>
          <IdeaStarter focusLogin={Boolean(error && ERRORS[error])} />
          <div className="hero-assurances">
            <span>
              <Icon name="check" size={14} />
              شروع با طرح رایگان
            </span>
            <span>
              <Icon name="git-branch" size={14} />
              مالکیت کامل کد
            </span>
            <span>
              <Icon name="globe" size={14} />
              ساخته‌شده برای فارسی
            </span>
          </div>
        </section>

        <section className="page-container showcase-section" aria-label="نمونهٔ فضای کاری">
          <ProductPreview />
        </section>

        <section className="tool-strip page-container" aria-label="فناوری‌های پشتیبانی‌شده">
          <p>با ابزارهایی که می‌شناسی، بساز.</p>
          <div>
            <span>OpenAI</span>
            <span>Claude</span>
            <span>Gemini</span>
            <i />
            <span>
              <Icon name="git-branch" size={17} />
              GitHub
            </span>
            <span>Vercel</span>
            <span>Neon</span>
          </div>
        </section>

        <section id="how" className="how-section page-container">
          <div className="landing-section-heading">
            <div>
              <span className="eyebrow">از فکر تا محصول</span>
              <h2>
                مسیر ساخت،
                <br />
                روشن‌تر از همیشه.
              </h2>
            </div>
            <p>
              تو تصمیم‌های مهم را می‌گیری.
              <br />
              تیم تخصصی، جزئیات ساخت را پیش می‌برد.
            </p>
          </div>
          <div className="how-grid">
            {[
              {
                number: "۰۱",
                icon: "pencil" as const,
                title: "ایده‌ات را تعریف کن",
                text: "به زبان خودت بنویس چه می‌خواهی بسازی. تصویر و فایل مرجع هم می‌توانی اضافه کنی.",
              },
              {
                number: "۰۲",
                icon: "sparkles" as const,
                title: "با تیمت شکلش بده",
                text: "نیازمندی‌ها را بررسی و تأیید کن؛ سپس طراحی، کدنویسی و ارزیابی را دنبال کن.",
              },
              {
                number: "۰۳",
                icon: "rocket" as const,
                title: "نسخه‌ات را منتشر کن",
                text: "کد را در GitHub خودت نگه دار، خروجی Android بگیر یا وب‌سایتت را منتشر کن.",
              },
            ].map((step) => (
              <article key={step.number} className="how-step">
                <div>
                  <span>{step.number}</span>
                  <Icon name={step.icon} size={23} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="team" className="team-section">
          <div className="page-container">
            <div className="landing-section-heading">
              <div>
                <span className="eyebrow">تخصص‌های متفاوت، یک هدف مشترک</span>
                <h2>
                  پشت هر ایدهٔ خوب،
                  <br />
                  یک تیم خوب ایستاده.
                </h2>
              </div>
              <p>
                هر ایجنت مسئولیت مشخص خودش را دارد.
                <br />
                گزارش و نتیجهٔ کارشان را در پروژه می‌بینی.
              </p>
            </div>
            <div className="specialist-grid">
              {SPECIALISTS.map((agent) => (
                <article key={agent.name} className="specialist-card">
                  <div className="specialist-card-top">
                    <span className="specialist-icon">
                      <Icon name={agent.icon} size={22} />
                    </span>
                    <span className="specialist-number">{agent.number}</span>
                  </div>
                  <h3>{agent.name}</h3>
                  <p>{agent.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ownership-section page-container">
          <div className="ownership-mark" aria-hidden="true">
            <Icon name="git-branch" size={38} />
            <span className="ownership-orbit orbit-one" />
            <span className="ownership-orbit orbit-two" />
          </div>
          <div>
            <span className="eyebrow">از اولین خط تا آخرین نسخه</span>
            <h2>
              ایده مال توست.
              <br />
              کد هم همین‌طور.
            </h2>
            <p>
              کد پروژه در مخزن GitHub خودت ذخیره می‌شود. آن را ببین، ویرایش کن، دانلود کن و روی زیرساخت دلخواهت ادامه
              بده.
            </p>
            <Link href="/guides" className="text-link">
              راهنمای ساخت و انتشار
              <Icon name="arrow-left" size={16} />
            </Link>
          </div>
        </section>

        <section id="login" className="login-section page-container">
          <div className="login-copy">
            <span className="eyebrow">ایدهٔ بعدی، از همین‌جا</span>
            <h2>
              برای ساختن
              <br />
              آماده‌ای؟
            </h2>
            <p>
              وارد شو و اولین پروژه‌ات را شروع کن.
              <br />
              ایده‌ای که نوشتی در همین مرورگر همراهت می‌ماند.
            </p>
            <div className="login-promise">
              <Icon name="shield" size={20} />
              <span>
                انتخاب مدل با توست.<small>با اعتبار پلتفرم یا کلید شخصی خودت کار کن.</small>
              </span>
            </div>
          </div>
          <div className="login-form-wrap">
            {error && ERRORS[error] && (
              <div role="alert" className="alert alert-danger mb-4">
                <Icon name="alert-circle" className="mt-1" />
                <span>
                  {ERRORS[error]}
                  {(error === "provider_denied" || error === "oauth_failed") &&
                    detail &&
                    /^[a-z0-9_]{1,60}$/.test(detail) && (
                      <>
                        {" "}
                        (<span dir="ltr">{detail}</span>)
                      </>
                    )}
                </span>
              </div>
            )}
            <EmailLogin
              providers={enabledSocialProviders()}
              turnstileSiteKey={turnstileEnabled() ? env.turnstileSiteKey() : undefined}
            />
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="page-container">
          <div className="footer-main">
            <Brand />
            <p>جایی برای ایده‌هایی که قرار است ساخته شوند.</p>
            <nav aria-label="پاورقی">
              <Link href="/pricing">طرح‌ها و قیمت‌ها</Link>
              <Link href="/guides">راهنما</Link>
              <a href="#login">شروع ساخت</a>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>با فکر تو، با کمک هوش مصنوعی.</span>
            <span dir="ltr">Idea2App AI — Make your next idea happen.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
