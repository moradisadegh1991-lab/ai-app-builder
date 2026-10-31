
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Attachment } from "@/lib/attachments";
import { prepareAttachments } from "@/lib/attachments-client";
import { api, type ProviderInfo, type ProvidersResponse } from "./api";
import { AttachmentPicker } from "./AttachmentPicker";
import { Icon, type IconName } from "./ui/Icon";

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
  icon: IconName;
  title: string;
  text: string;
  badge?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="choice group">
      <span className="flex w-full items-center justify-between">
        <span
          className={`grid size-10 place-items-center rounded-lg transition ${
            selected ? "bg-primary text-primary-fg" : "bg-surface-3 text-fg-2 group-hover:text-fg"
          }`}
        >
          <Icon name={icon} size={20} />
        </span>
        <span
          className={`grid size-5 place-items-center rounded-full border transition ${
            selected ? "border-primary bg-primary text-primary-fg" : "border-line-strong"
          }`}
          aria-hidden="true"
        >
          {selected && <Icon name="check" size={12} strokeWidth={3} />}
        </span>
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-2 font-semibold text-fg">
        {title}
        {badge && <span className="badge badge-success">{badge}</span>}
      </span>
      <span className="text-xs leading-6 text-muted">{text}</span>
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
      <legend className="flex items-center gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-fg">
          {number.toLocaleString("fa-IR")}
        </span>
        <span className="text-base font-bold text-fg">{title}</span>
      </legend>
      {description && <p className="-mt-1 text-sm leading-7 text-muted">{description}</p>}
      {children}
    </fieldset>
  );
}

/** Stepper: completed steps are ticked, the current one is highlighted. */
function Progress({ steps, activeIndex }: { steps: { key: StepKey; title: string }[]; activeIndex: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="مراحل ساخت پروژه">
      {steps.map((step, index) => {
        const completed = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition ${
                completed ? "bg-success text-white" : active ? "bg-primary text-primary-fg" : "border border-line-strong bg-surface text-muted"
              }`}
            >
              {completed ? <Icon name="check" size={12} strokeWidth={3} /> : (index + 1).toLocaleString("fa-IR")}
            </span>
            <span className={`hidden truncate text-xs font-semibold sm:block ${active ? "text-fg" : "text-muted"}`}>{STEP_LABELS[step.key]}</span>
            {index < steps.length - 1 && <span className={`h-px min-w-4 flex-1 ${completed ? "bg-success" : "bg-line"}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
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
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-6" aria-labelledby="new-project-title">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="new-project-title" className="section-title">
            پروژهٔ جدید
          </h2>
          <p className="mt-0.5 text-sm text-muted">در چند مرحله نوع محصول و محل انتشار را انتخاب کنید و ایده را بنویسید.</p>
        </div>
        <div className="w-full sm:max-w-md">
          <Progress steps={steps} activeIndex={safeStep} />
        </div>
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
              icon="globe"
              title="وب‌سایت"
              text="سایت واکنش‌گرا برای موبایل و دسکتاپ؛ مناسب معرفی کسب‌وکار، پنل‌ها و سرویس‌های تحت وب."
            />

            <Choice
              selected={kind === "app"}
              onClick={() => selectKind("app")}
              icon="smartphone"
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
              icon="smartphone"
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
              icon="cloud"
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
              icon="server"
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
              icon="sparkles"
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
              icon="zap"
              title="Vercel + Neon"
              text="استفاده از سرویس‌های ابری برای استقرار وب‌اپلیکیشن و دیتابیس، بدون مدیریت VPS."
              badge="راه‌اندازی ساده"
            />
          </div>

          {hosting === "free-vps" && (
            <div className="panel-muted space-y-3 p-4">
              <div>
                <h3 className="text-sm font-bold text-fg">
                  ارائه‌دهنده VPS را انتخاب کنید
                </h3>
                <p className="mt-1 text-xs text-muted">
                  شرایط ثبت‌نام و دسترسی به پلن‌های رایگان به سیاست‌های هر
                  ارائه‌دهنده بستگی دارد.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Choice
                  selected={vpsProvider === "oracle"}
                  onClick={() => setVpsProvider("oracle")}
                  icon="cloud"
                  title="Oracle Cloud"
                  text="گزینه‌های Always Free برای برخی منابع محاسباتی."
                  badge="پیشنهادی"
                />

                <Choice
                  selected={vpsProvider === "gcp"}
                  onClick={() => setVpsProvider("gcp")}
                  icon="cloud"
                  title="Google Cloud"
                  text="پلن‌های رایگان محدود و اعتبارهای آزمایشی."
                />

                <Choice
                  selected={vpsProvider === "aws"}
                  onClick={() => setVpsProvider("aws")}
                  icon="cloud"
                  title="Amazon AWS"
                  text="پلن‌های رایگان و اعتبارهای مشروط به شرایط حساب."
                />
              </div>

              <p className="rounded-xl border border-warning-line bg-warning-soft p-3 text-xs leading-6 text-warning-fg">
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
                className="text-sm font-bold text-fg"
                htmlFor="idea"
              >
                توضیحات ایده
              </label>

              <span
                className={`text-xs ${
                  idea.trim().length >= 15
                    ? "text-success-fg"
                    : "text-faint"
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
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-start text-xs text-fg-2 transition hover:border-primary-line hover:bg-primary-soft hover:text-primary-soft-fg"
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
                <span className="ms-1 font-normal text-faint">
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

                <p className="form-hint">
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
                <p className="form-hint !text-danger-fg">
                  دریافت فهرست مدل‌ها ناموفق بود: {providerError}
                </p>
              )}
            </div>
          </div>

          {/* Configuration summary */}
          <div className="panel-muted p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
              <Icon name="layers" size={16} className="text-primary" />
              خلاصهٔ تنظیمات پروژه
            </h3>

            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="text-muted">نوع محصول</p>
                <p className="mt-1 font-bold text-fg">
                  {kind === "app" ? "اپلیکیشن اندروید" : "وب‌سایت"}
                </p>
              </div>

              <div>
                <p className="text-muted">زیرساخت</p>
                <p className="mt-1 font-bold text-fg">
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
                  <p className="text-muted">فناوری اپ</p>
                  <p className="mt-1 font-bold text-fg">
                    {template === "capacitor"
                      ? "React + Capacitor"
                      : "React Native + Expo"}
                  </p>
                </div>
              )}

              <div>
                <p className="text-muted">مدل هوش مصنوعی</p>
                <p className="mt-1 font-bold text-fg">
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
          className="alert alert-danger"
        >
          <Icon name="alert-circle" className="mt-1" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={safeStep === 0 || busy}
          className="btn-secondary"
        >
          <Icon name="arrow-right" size={16} />
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
            className="btn-primary btn-lg"
          >
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" />
                در حال ساخت پروژه…
              </>
            ) : (
              <>
                <Icon name="sparkles" size={16} />
                ساخت پروژه و شروع تحلیل
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={busy}
            className="btn-primary btn-lg"
          >
            ادامه
            <Icon name="arrow-left" size={16} />
          </button>
        )}
      </div>
    </form>
  );
}
