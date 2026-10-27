"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type ProviderInfo, type ProvidersResponse } from "./api";

type Kind = "app" | "website";
type Hosting = "vps" | "vercel";
type VpsProvider = "own" | "oracle" | "gcp" | "aws";

const EXAMPLES: Record<Kind, string[]> = {
  app: [
    "یک اپ مدیریت هزینه با ثبت درآمد، دسته‌بندی هزینه‌ها، گزارش ماهانه و نمودار",
    "اپ ثبت و پیگیری درخواست‌های تعمیرات تجهیزات کارخانه با وضعیت، اولویت و تاریخچه",
    "اپ عادت‌سازی روزانه با یادآور، شمارنده روزهای پیوسته و آمار هفتگی",
  ],
  website: [
    "سایت معرفی یک کافه با منو، گالری عکس، ساعت کاری و فرم رزرو میز",
    "سایت شخصی رزومه مهندس نگهداری و تعمیرات با نمونه‌کارها و فرم تماس",
    "سایت ثبت‌نام دوره آموزشی با معرفی دوره، سرفصل‌ها و فرم ثبت‌نام",
  ],
};

function Choice({
  selected,
  onClick,
  icon,
  title,
  text,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  text: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-start transition ${
        selected
          ? "border-brand-600 bg-brand-50 dark:bg-brand-700/20"
          : "border-slate-200 hover:border-brand-500 dark:border-slate-700"
      }`}
    >
      <span className="text-3xl" aria-hidden>
        {icon}
      </span>
      <span className="flex items-center gap-2 font-bold">
        {title}
        {badge && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{badge}</span>}
      </span>
      <span className="text-xs leading-6 text-slate-600 dark:text-slate-400">{text}</span>
    </button>
  );
}

function Question({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 flex items-center gap-2 font-bold">
        <span className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">
          {number.toLocaleString("fa-IR")}
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export function NewProjectForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind | null>(null);
  const [needsCloud, setNeedsCloud] = useState<boolean | null>(null);
  const [hosting, setHosting] = useState<Hosting | "free-vps" | null>(null);
  const [vpsProvider, setVpsProvider] = useState<VpsProvider | null>(null);
  const [idea, setIdea] = useState("");
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<"capacitor" | "expo">("capacitor");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [aiProvider, setAiProvider] = useState<ProviderInfo["id"] | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ProvidersResponse>("/api/ai/providers")
      .then((data) => {
        setProviders(data.providers);
        setAiProvider((current) => current || data.providers.find((p) => p.available)?.id || "");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const online = kind === "website" || needsCloud === true;
  const hostingDone =
    kind !== null &&
    (!online || hosting === "vercel" || (hosting === "vps" && vpsProvider === "own") || (hosting === "free-vps" && vpsProvider !== null));
  const showHosting = kind === "website" || (kind === "app" && needsCloud === true);
  const showDetails = kind !== null && (kind === "website" || needsCloud !== null) && hostingDone;

  function selectKind(value: Kind) {
    setKind(value);
    setNeedsCloud(value === "website" ? null : needsCloud);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!aiProvider) return setError("هیچ مدل هوش مصنوعی در دسترس نیست؛ از صفحه تنظیمات یک کلید API اضافه کنید.");
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          idea,
          name: name || undefined,
          kind,
          template,
          needsCloud: kind === "app" ? needsCloud === true : true,
          hosting: !online ? "none" : hosting === "vercel" ? "vercel" : "vps",
          vpsProvider: hosting === "vps" || hosting === "free-vps" ? vpsProvider : undefined,
          aiProvider,
        }),
      });
      router.push(`/projects/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  let number = 1;
  return (
    <form onSubmit={submit} className="card flex flex-col gap-8">
      <h2 className="text-lg font-bold">پروژه جدید</h2>

      <Question number={number++} title="چه چیزی می‌خواهید بسازید؟">
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice
            selected={kind === "website"}
            onClick={() => selectKind("website")}
            icon="🌐"
            title="وب‌سایت"
            text="سایت واکنش‌گرا برای موبایل و دسکتاپ؛ روی اینترنت و با نشانی HTTPS منتشر می‌شود."
          />
          <Choice
            selected={kind === "app"}
            onClick={() => selectKind("app")}
            icon="📱"
            title="اپ اندروید"
            text="فایل APK قابل نصب روی گوشی، ساخته‌شده با GitHub Actions."
          />
        </div>
      </Question>

      {kind === "app" && (
        <Question number={number++} title="اپ به سرور و فضای ابری نیاز دارد؟">
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              selected={needsCloud === false}
              onClick={() => {
                setNeedsCloud(false);
                setHosting(null);
              }}
              icon="📴"
              title="فقط روی گوشی (محلی)"
              text="داده‌ها روی خود گوشی ذخیره می‌شوند؛ سرور لازم نیست. مثل دفترچه، حساب‌داری شخصی یا ابزارهای آفلاین."
              badge="ساده‌ترین"
            />
            <Choice
              selected={needsCloud === true}
              onClick={() => setNeedsCloud(true)}
              icon="☁️"
              title="با سرور و دیتابیس ابری"
              text="برای ورود کاربران، داده مشترک بین چند گوشی، همگام‌سازی یا پنل مدیریت."
            />
          </div>
        </Question>
      )}

      {showHosting && (
        <Question number={number++} title="سرور کجا اجرا شود؟">
          <div className="grid gap-3 sm:grid-cols-3">
            <Choice
              selected={hosting === "vps"}
              onClick={() => {
                setHosting("vps");
                setVpsProvider("own");
              }}
              icon="🖥️"
              title="VPS خودم را دارم"
              text="یک دستور روی سرور اجرا می‌کنید؛ ایجنت Idea2App کد را از GitHub می‌گیرد، Build و با HTTPS اجرا می‌کند و هر نسخه جدید را خودکار مستقر می‌کند."
            />
            <Choice
              selected={hosting === "free-vps"}
              onClick={() => {
                setHosting("free-vps");
                setVpsProvider(null);
              }}
              icon="🎁"
              title="VPS رایگان می‌خواهم"
              text="Oracle، Google یا AWS با آموزش تصویری. فقط یک اسکریپت هنگام ساخت سرور می‌گذارید؛ نصب خودکار است."
            />
            <Choice
              selected={hosting === "vercel"}
              onClick={() => {
                setHosting("vercel");
                setVpsProvider(null);
              }}
              icon="⚡"
              title="Vercel + Neon رایگان"
              text="بدون سرور و بدون کارت بانکی؛ Idea2App همه‌چیز را خودش می‌سازد و مستقر می‌کند."
              badge="کاملاً خودکار"
            />
          </div>
          {hosting === "free-vps" && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="grid gap-3 sm:grid-cols-3">
                <Choice
                  selected={vpsProvider === "oracle"}
                  onClick={() => setVpsProvider("oracle")}
                  icon="🟥"
                  title="Oracle Cloud"
                  text="Always Free: سرور ARM تا ۲ هسته و ۱۲ گیگ رم، دائمی (ممکن است سرور کم‌مصرف پس گرفته شود)."
                  badge="پیشنهادی"
                />
                <Choice
                  selected={vpsProvider === "gcp"}
                  onClick={() => setVpsProvider("gcp")}
                  icon="🟦"
                  title="Google Cloud"
                  text="e2-micro دائمی رایگان (۱ گیگ رم) در منطقه‌های آمریکا."
                />
                <Choice
                  selected={vpsProvider === "aws"}
                  onClick={() => setVpsProvider("aws")}
                  icon="🟧"
                  title="Amazon AWS"
                  text="اعتبار رایگان حساب‌های جدید (چند ماه)."
                />
              </div>
              <p className="rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                ⚠️ هر سه سرویس برای تأیید هویت یک کارت بانکی بین‌المللی می‌خواهند و کارت‌های ایرانی را نمی‌پذیرند. اگر کارت
                بین‌المللی ندارید، گزینه «Vercel + Neon» بدون کارت کار می‌کند.
              </p>
            </div>
          )}
        </Question>
      )}

      {showDetails && kind && (
        <Question number={number++} title={kind === "website" ? "سایت را توضیح دهید" : "اپ را توضیح دهید"}>
          <div>
            <textarea
              id="idea"
              aria-label="ایده"
              className="input min-h-32 resize-y"
              placeholder="با جزئیات بنویسید: مخاطب کیست، چه صفحاتی لازم است، چه اطلاعاتی ثبت یا نمایش داده می‌شود…"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              required
              minLength={15}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES[kind].map((example) => (
                <button
                  type="button"
                  key={example}
                  onClick={() => setIdea(example)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  {example.slice(0, 40)}…
                </button>
              ))}
            </div>
          </div>

          <div className={`grid gap-4 ${kind === "app" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <div>
              <label className="label" htmlFor="name">
                نام انگلیسی کوتاه (اختیاری)
              </label>
              <input
                id="name"
                className="input"
                dir="ltr"
                placeholder={kind === "website" ? "cafe-site" : "expense-tracker"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
            </div>
            {kind === "app" && (
              <div>
                <label className="label" htmlFor="template">
                  فناوری اپ
                </label>
                <select
                  id="template"
                  className="input"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as "capacitor" | "expo")}
                >
                  <option value="capacitor">React + Capacitor (پیشنهادی، Build سریع‌تر)</option>
                  <option value="expo">React Native (Expo)، رابط بومی</option>
                </select>
              </div>
            )}
            <div>
              <label className="label" htmlFor="provider">
                مدل هوش مصنوعی
              </label>
              <select
                id="provider"
                className="input"
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as ProviderInfo["id"])}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.available}>
                    {p.label}
                    {p.available ? ` — ${p.model}` : " (غیرفعال)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <button className="btn-primary" disabled={busy || idea.trim().length < 15}>
              {busy ? "در حال ساخت پروژه…" : "ساخت پروژه و شروع تحلیل"}
            </button>
          </div>
        </Question>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
