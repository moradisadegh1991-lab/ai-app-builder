
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Attachment } from "@/lib/attachments";
import { prepareAttachments } from "@/lib/attachments-client";
import { api, type ProviderInfo, type ProvidersResponse } from "./api";
import { AttachmentPicker } from "./AttachmentPicker";

type Kind = "app" | "website";
type Hosting = "vps" | "vercel";
type VpsProvider = "own" | "oracle" | "gcp" | "aws";
type Template = "capacitor" | "expo";
type StepKey = "kind" | "cloud" | "hosting" | "details";

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

const STEP_LABELS: Record<StepKey, string> = {
  kind: "نوع محصول",
  cloud: "زیرساخت",
  hosting: "محل انتشار",
  details: "مشخصات پروژه",
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
      className={`project-choice group flex h-full flex-col items-start gap-3 rounded-2xl border-2 p-4 text-start transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        selected
          ? "project-choice-selected border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-500/10 dark:bg-indigo-950/30"
          : "border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <span className="flex w-full items-center justify-between">
        <span className="text-3xl" aria-hidden="true">
          {icon}
        </span>

        {selected && (
          <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
            ✓
          </span>
        )}
      </span>

      <span className="flex flex-wrap items-center gap-2 font-bold text-slate-900 dark:text-white">
        {title}

        {badge && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {badge}
          </span>
        )}
      </span>

      <span className="text-xs leading-6 text-slate-600 dark:text-slate-400">
        {text}
      </span>
    </button>
  );
}

function Question({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="flex items-center gap-3 font-bold text-slate-900 dark:text-white">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm text-white shadow-md shadow-indigo-600/20">
          {number.toLocaleString("fa-IR")}
        </span>
        <span className="text-base">{title}</span>
      </legend>

      {description && (
        <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}

      {children}
    </fieldset>
  );
}

function Progress({
  steps,
  activeIndex,
}: {
  steps: { key: StepKey; title: string }[];
  activeIndex: number;
}) {
  const percentage =
    steps.length <= 1 ? 100 : (activeIndex / (steps.length - 1)) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
          مرحله {Math.min(activeIndex + 1, steps.length).toLocaleString("fa-IR")} از{" "}
          {steps.length.toLocaleString("fa-IR")}
        </span>

        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          {steps[activeIndex]?.title}
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentage)}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const completed = index < activeIndex;
          const active = index === activeIndex;

          return (
            <div key={step.key} className="min-w-0 text-center">
              <div
                className={`mx-auto flex size-7 items-center justify-center rounded-full text-[10px] font-bold transition ${
                  completed
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                }`}
              >
                {completed ? "✓" : (index + 1).toLocaleString("fa-IR")}
              </div>

              <p
                className={`mt-2 truncate text-[9px] font-semibold sm:text-[10px] ${
                  active
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400"
                }`}
              >
                {STEP_LABELS[step.key]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NewProjectForm() {
  const router = useRouter();

  const [kind, setKind] = useState<Kind | null>(null);
  const [needsCloud, setNeedsCloud] = useState<boolean | null>(null);
  const [hosting, setHosting] = useState<Hosting | "free-vps" | null>(null);
  const [vpsProvider, setVpsProvider] = useState<VpsProvider | null>(null);

  const [idea, setIdea] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachErrors, setAttachErrors] = useState<string[]>([]);
  const [attachWorking, setAttachWorking] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<Template>("capacitor");

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [aiProvider, setAiProvider] = useState<ProviderInfo["id"] | "">("");
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    api<ProvidersResponse>("/api/ai/providers")
      .then((data) => {
        if (!mounted) return;

        setProviders(data.providers);
        setAiProvider(
          (current) =>
            current || data.providers.find((provider) => provider.available)?.id || "",
        );
        setProviderError(null);
      })
      .catch((e: Error) => {
        if (mounted) setProviderError(e.message);
      })
      .finally(() => {
        if (mounted) setProviderLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const online = kind === "website" || needsCloud === true;

  const showHosting =
    kind === "website" || (kind === "app" && needsCloud === true);

  const hostingDone =
    kind !== null &&
    (!online ||
      hosting === "vercel" ||
      (hosting === "vps" && vpsProvider === "own") ||
      (hosting === "free-vps" && vpsProvider !== null));

  const detailsReady =
    kind === "website" ||
    (kind === "app" && needsCloud !== null && hostingDone);

  const steps: { key: StepKey; title: string }[] = [
    { key: "kind", title: "انتخاب نوع محصول" },
  ];

  if (kind === "app") {
    steps.push({ key: "cloud", title: "تعیین نیاز به سرور" });
  }

  if (showHosting) {
    steps.push({ key: "hosting", title: "انتخاب زیرساخت انتشار" });
  }

  if (detailsReady) {
    steps.push({ key: "details", title: "توضیحات و تنظیمات نهایی" });
  }

  const safeStep = Math.min(activeStep, steps.length - 1);
  const currentStep = steps[safeStep]?.key ?? "kind";
  const isLastStep = currentStep === "details";

  function selectKind(value: Kind) {
    setKind(value);
    setHosting(null);
    setVpsProvider(null);
    setError(null);
    setActiveStep(0);

    if (value === "website") {
      setNeedsCloud(null);
    }
  }

  function goNext() {
    setError(null);

    if (currentStep === "kind" && !kind) {
      setError("ابتدا نوع محصول موردنظر را انتخاب کنید.");
      return;
    }

    if (currentStep === "cloud" && needsCloud === null) {
      setError("مشخص کنید اپلیکیشن به سرور و دیتابیس ابری نیاز دارد یا خیر.");
      return;
    }

    if (currentStep === "hosting" && !hostingDone) {
      setError("لطفاً روش میزبانی و ارائه‌دهنده سرور را کامل انتخاب کنید.");
      return;
    }

    if (currentStep === "details") {
      if (idea.trim().length < 15) {
        setError("توضیحات ایده باید حداقل ۱۵ کاراکتر باشد.");
        return;
      }

      if (!aiProvider) {
        setError("یک مدل هوش مصنوعی در دسترس انتخاب کنید.");
        return;
      }
    }

    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setError(null);
    setActiveStep((current) => Math.max(0, current - 1));
  }

  async function addAttachments(files: File[]) {
    if (!files.length) return;
    setAttachWorking(true);
    const result = await prepareAttachments(files, attachments);
    setAttachWorking(false);
    setAttachErrors(result.errors);
    setAttachments(result.items);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!kind) {
      setError("نوع محصول انتخاب نشده است.");
      return;
    }

    if (idea.trim().length < 15) {
      setError("توضیحات ایده باید حداقل ۱۵ کاراکتر باشد.");
      return;
    }

    if (!aiProvider) {
      setError(
        "هیچ مدل هوش مصنوعی در دسترس نیست؛ از صفحه تنظیمات یک کلید API اضافه کنید.",
      );
      return;
    }

    if (!hostingDone) {
      setError("تنظیمات میزبانی پروژه کامل نشده است.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          idea,
          attachments,
          name: name || undefined,
          kind,
          template,
          needsCloud: kind === "app" ? needsCloud === true : true,
          hosting: !online
            ? "none"
            : hosting === "vercel"
              ? "vercel"
              : "vps",
          vpsProvider:
            hosting === "vps" || hosting === "free-vps"
              ? vpsProvider
              : undefined,
          aiProvider,
        }),
      });

      router.push(`/projects/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isLastStep) {
      event.preventDefault();
      goNext();
      return;
    }

    void submit(event);
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className="project-creator card flex flex-col gap-7"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="project-eyebrow">IDEA2APP BUILDER</span>

          <h2 className="mt-2 text-xl font-extrabold text-slate-950 dark:text-white">
            ایده‌ات را به محصول تبدیل کن
          </h2>

          <p className="mt-2 max-w-xl text-xs leading-6 text-slate-500 dark:text-slate-400">
            در چند مرحله ساده، مشخصات محصولت را انتخاب کن تا فرایند تحلیل و
            ساخت پروژه شروع شود.
          </p>
        </div>

        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          ✦
        </span>
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <Progress steps={steps} activeIndex={safeStep} />
      </div>

      {/* Step 1: Product type */}
      {currentStep === "kind" && (
        <Question
          number={1}
          title="چه چیزی می‌خواهید بسازید؟"
          description="نوع محصول خروجی را انتخاب کنید. در مراحل بعدی تنظیمات مربوط به همان محصول نمایش داده می‌شود."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              selected={kind === "website"}
              onClick={() => selectKind("website")}
              icon="🌐"
              title="وب‌سایت"
              text="سایت واکنش‌گرا برای موبایل و دسکتاپ؛ مناسب معرفی کسب‌وکار، پنل‌ها و سرویس‌های تحت وب."
            />

            <Choice
              selected={kind === "app"}
              onClick={() => selectKind("app")}
              icon="📱"
              title="اپ اندروید"
              text="ساخت اپلیکیشن اندروید و آماده‌سازی فایل APK با استفاده از GitHub Actions."
            />
          </div>
        </Question>
      )}

      {/* Step 2: Cloud requirement */}
      {currentStep === "cloud" && (
        <Question
          number={2}
          title="اپلیکیشن به سرور و فضای ابری نیاز دارد؟"
          description="اگر کاربران باید اطلاعات مشترک داشته باشند یا از چند دستگاه استفاده کنند، گزینه ابری مناسب‌تر است."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              selected={needsCloud === false}
              onClick={() => {
                setNeedsCloud(false);
                setHosting(null);
                setVpsProvider(null);
                setError(null);
              }}
              icon="📴"
              title="فقط روی گوشی (محلی)"
              text="اطلاعات روی خود گوشی ذخیره می‌شوند؛ سرور لازم نیست. مناسب ابزارهای آفلاین، دفترچه و حسابداری شخصی."
              badge="ساده‌تر"
            />

            <Choice
              selected={needsCloud === true}
              onClick={() => {
                setNeedsCloud(true);
                setError(null);
              }}
              icon="☁️"
              title="با سرور و دیتابیس ابری"
              text="مناسب ورود کاربران، ذخیره اطلاعات مشترک، همگام‌سازی بین دستگاه‌ها و پنل مدیریت."
            />
          </div>
        </Question>
      )}

      {/* Step 3: Hosting */}
      {currentStep === "hosting" && (
        <Question
          number={kind === "website" ? 2 : 3}
          title="محل اجرای پروژه را انتخاب کنید"
          description="مشخص کنید پروژه روی زیرساخت اختصاصی شما اجرا شود یا از سرویس میزبانی ابری استفاده کند."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Choice
              selected={hosting === "vps"}
              onClick={() => {
                setHosting("vps");
                setVpsProvider("own");
                setError(null);
              }}
              icon="🖥️"
              title="VPS خودم را دارم"
              text="یک دستور روی سرور اجرا می‌کنید؛ ایجنت Idea2App کد را از GitHub دریافت می‌کند، Build و با HTTPS اجرا می‌کند."
            />

            <Choice
              selected={hosting === "free-vps"}
              onClick={() => {
                setHosting("free-vps");
                setVpsProvider(null);
                setError(null);
              }}
              icon="🎁"
              title="VPS رایگان می‌خواهم"
              text="انتخاب ارائه‌دهنده و دریافت راهنمای راه‌اندازی سرور از Oracle، Google یا AWS."
            />

            <Choice
              selected={hosting === "vercel"}
              onClick={() => {
                setHosting("vercel");
                setVpsProvider(null);
                setError(null);
              }}
              icon="⚡"
              title="Vercel + Neon"
              text="استفاده از سرویس‌های ابری برای استقرار وب‌اپلیکیشن و دیتابیس، بدون مدیریت VPS."
              badge="راه‌اندازی ساده"
            />
          </div>

          {hosting === "free-vps" && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ارائه‌دهنده VPS را انتخاب کنید
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  شرایط ثبت‌نام و دسترسی به پلن‌های رایگان به سیاست‌های هر
                  ارائه‌دهنده بستگی دارد.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Choice
                  selected={vpsProvider === "oracle"}
                  onClick={() => setVpsProvider("oracle")}
                  icon="🟥"
                  title="Oracle Cloud"
                  text="گزینه‌های Always Free برای برخی منابع محاسباتی."
                  badge="پیشنهادی"
                />

                <Choice
                  selected={vpsProvider === "gcp"}
                  onClick={() => setVpsProvider("gcp")}
                  icon="🟦"
                  title="Google Cloud"
                  text="پلن‌های رایگان محدود و اعتبارهای آزمایشی."
                />

                <Choice
                  selected={vpsProvider === "aws"}
                  onClick={() => setVpsProvider("aws")}
                  icon="🟧"
                  title="Amazon AWS"
                  text="پلن‌های رایگان و اعتبارهای مشروط به شرایط حساب."
                />
              </div>

              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                توجه: پیش از ثبت‌نام، شرایط احراز هویت، روش پرداخت، محدودیت
                منطقه‌ای و اعتبار پلن رایگان را در وب‌سایت رسمی سرویس بررسی کنید.
              </p>
            </div>
          )}
        </Question>
      )}

      {/* Step 4: Project details */}
      {currentStep === "details" && kind && (
        <Question
          number={kind === "website" ? 3 : showHosting ? 4 : 3}
          title="مشخصات پروژه را وارد کنید"
          description="هرچه توضیحات دقیق‌تر باشد، تحلیل نیازمندی‌ها و خروجی اولیه پروژه هدفمندتر خواهد بود."
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                className="text-sm font-bold text-slate-800 dark:text-slate-200"
                htmlFor="idea"
              >
                توضیحات ایده
              </label>

              <span
                className={`text-[10px] ${
                  idea.trim().length >= 15
                    ? "text-emerald-600"
                    : "text-slate-400"
                }`}
              >
                {idea.trim().length.toLocaleString("fa-IR")} / حداقل ۱۵ کاراکتر
              </span>
            </div>

            <textarea
              id="idea"
              aria-label="توضیحات ایده"
              className="input min-h-36 resize-y leading-7"
              placeholder="با جزئیات توضیح دهید: محصول برای چه کسانی است؟ چه امکاناتی دارد؟ چه صفحاتی لازم است؟ چه اطلاعاتی باید ثبت یا نمایش داده شود؟"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              onPaste={(event) => {
                // A pasted screenshot becomes an attachment; pasted text behaves as usual.
                const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
                if (images.length) {
                  event.preventDefault();
                  void addAttachments(images);
                }
              }}
              required
              minLength={15}
            />

            <AttachmentPicker
              value={attachments}
              onAdd={(files) => void addAttachments(files)}
              onRemove={(index) => {
                setAttachments((current) => current.filter((_, i) => i !== index));
                setAttachErrors([]);
              }}
              working={attachWorking}
              errors={attachErrors}
              disabled={busy}
            />

            <div className="flex flex-wrap gap-2">
              {EXAMPLES[kind].map((example, index) => (
                <button
                  type="button"
                  key={example}
                  onClick={() => setIdea(example)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-start text-[10px] text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-indigo-950/40"
                >
                  {`نمونه ${index + 1}: ${example.slice(0, 35)}…`}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`grid gap-4 ${
              kind === "app" ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            <div>
              <label className="label" htmlFor="name">
                نام انگلیسی پروژه
                <span className="ms-1 font-normal text-slate-400">
                  (اختیاری)
                </span>
              </label>

              <input
                id="name"
                className="input"
                dir="ltr"
                placeholder={kind === "website" ? "cafe-site" : "expense-tracker"}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
              />
            </div>

            {kind === "app" && (
              <div>
                <label className="label" htmlFor="template">
                  فناوری اپلیکیشن
                </label>

                <select
                  id="template"
                  className="input"
                  value={template}
                  onChange={(event) =>
                    setTemplate(event.target.value as Template)
                  }
                >
                  <option value="capacitor">
                    React + Capacitor
                  </option>
                  <option value="expo">
                    React Native (Expo)
                  </option>
                </select>

                <p className="mt-1 text-[10px] leading-5 text-slate-400">
                  فناوری موردنظر برای تولید اپلیکیشن
                </p>
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
                onChange={(event) =>
                  setAiProvider(event.target.value as ProviderInfo["id"])
                }
                disabled={providerLoading || providers.length === 0}
              >
                {providerLoading && (
                  <option value="">در حال دریافت مدل‌ها...</option>
                )}

                {!providerLoading && providers.length === 0 && (
                  <option value="">مدلی در دسترس نیست</option>
                )}

                {providers.map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                    disabled={!provider.available}
                  >
                    {provider.label}
                    {provider.available
                      ? ` — ${provider.model}`
                      : " (غیرفعال)"}
                  </option>
                ))}
              </select>

              {providerError && (
                <p className="mt-1 text-[10px] leading-5 text-rose-500">
                  دریافت فهرست مدل‌ها ناموفق بود: {providerError}
                </p>
              )}
            </div>
          </div>

          {/* Configuration summary */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">✓</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                خلاصه تنظیمات پروژه
              </h3>
            </div>

            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="text-slate-500">نوع محصول</p>
                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {kind === "app" ? "اپلیکیشن اندروید" : "وب‌سایت"}
                </p>
              </div>

              <div>
                <p className="text-slate-500">زیرساخت</p>
                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {!online
                    ? "محلی، بدون سرور"
                    : hosting === "vercel"
                      ? "Vercel + Neon"
                      : hosting === "free-vps"
                        ? `VPS رایگان — ${vpsProvider?.toUpperCase() ?? ""}`
                        : "VPS اختصاصی"}
                </p>
              </div>

              {kind === "app" && (
                <div>
                  <p className="text-slate-500">فناوری اپ</p>
                  <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                    {template === "capacitor"
                      ? "React + Capacitor"
                      : "React Native + Expo"}
                  </p>
                </div>
              )}

              <div>
                <p className="text-slate-500">مدل هوش مصنوعی</p>
                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {providers.find((provider) => provider.id === aiProvider)
                    ?.label ?? "انتخاب نشده"}
                </p>
              </div>
            </div>
          </div>
        </Question>
      )}

      {/* Errors */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={safeStep === 0 || busy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <span aria-hidden="true">→</span>
          مرحله قبل
        </button>

        {isLastStep ? (
          <button
            type="submit"
            disabled={
              busy ||
              idea.trim().length < 15 ||
              providerLoading ||
              !aiProvider ||
              !providers.some(
                (provider) =>
                  provider.id === aiProvider && provider.available,
              )
            }
            className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 px-6 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                در حال ساخت پروژه...
              </>
            ) : (
              <>
                ساخت پروژه و شروع تحلیل
                <span aria-hidden="true">←</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={busy}
            className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 px-6"
          >
            ادامه
            <span aria-hidden="true">←</span>
          </button>
        )}
      </div>
    </form>
  );
}
