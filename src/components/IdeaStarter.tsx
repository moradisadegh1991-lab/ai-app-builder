"use client";

import { useEffect, useRef, useState } from "react";
import { IDEA_DRAFT_KEY } from "@/lib/idea-draft";
import { Icon } from "./ui/Icon";

const EXAMPLES = [
  {
    label: "فروشگاه آنلاین",
    icon: "layers" as const,
    idea: "یک فروشگاه آنلاین مینیمال برای محصولات دست‌ساز با دسته‌بندی، سبد خرید و صفحه معرفی هر محصول",
  },
  {
    label: "اپ مدیریت کارها",
    icon: "check-circle" as const,
    idea: "یک اپ مدیریت کارهای روزانه با دسته‌بندی، اولویت‌بندی، یادآوری و نمایش پیشرفت کارها",
  },
  {
    label: "سایت شخصی",
    icon: "user" as const,
    idea: "یک وب‌سایت شخصی حرفه‌ای با معرفی من، نمونه‌کارها، مهارت‌ها و فرم تماس",
  },
];

export function IdeaStarter({ focusLogin = false }: { focusLogin?: boolean }) {
  const [idea, setIdea] = useState("");
  const [error, setError] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focusLogin) return;
    document.getElementById("login")?.scrollIntoView({ behavior: "instant", block: "start" });
    document.querySelector<HTMLElement>("#login a, #login input")?.focus({ preventScroll: true });
  }, [focusLogin]);

  function saveDraft(value: string) {
    try {
      sessionStorage.setItem(IDEA_DRAFT_KEY, value);
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }

  function start(event: React.FormEvent) {
    event.preventDefault();
    if (idea.trim().length < 15) {
      setError("ایده‌ات را کمی بیشتر توضیح بده؛ حداقل ۱۵ کاراکتر.");
      field.current?.focus();
      return;
    }
    saveDraft(idea.trim());
    setError("");
    document
      .getElementById("login")
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
    document.querySelector<HTMLElement>("#login a, #login input")?.focus({ preventScroll: true });
  }

  return (
    <div className="idea-starter">
      <form onSubmit={start} className="idea-composer">
        <label htmlFor="starting-idea" className="sr-only">
          چه چیزی می‌خواهی بسازی؟
        </label>
        <textarea
          id="starting-idea"
          ref={field}
          value={idea}
          maxLength={5000}
          rows={3}
          onChange={(e) => {
            setIdea(e.target.value);
            setError("");
          }}
          onBlur={() => {
            if (idea.trim()) saveDraft(idea.trim());
          }}
          placeholder="یک ایده دارم… مثلاً یک اپ برای مدیریت کارهای روزانه با طراحی ساده و زیبا"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "starting-idea-error" : "starting-idea-hint"}
        />
        <div className="composer-footer">
          <span id="starting-idea-hint" className="composer-hint">
            <Icon name="sparkles" size={15} /> از یک جمله شروع کن
          </span>
          <button type="submit" className="btn-primary">
            <span>ایده‌ام را بساز</span>
            <Icon name="arrow-left" size={17} />
          </button>
        </div>
      </form>
      {error && (
        <p id="starting-idea-error" role="alert" className="mt-3 text-sm text-danger-fg">
          {error}
        </p>
      )}
      <div className="idea-suggestions" aria-label="ایده‌های پیشنهادی">
        <span>یا الهام بگیر:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => {
              setIdea(example.idea);
              setError("");
              field.current?.focus();
            }}
          >
            <Icon name={example.icon} size={14} />
            {example.label}
            <Icon name="plus" size={12} />
          </button>
        ))}
      </div>
      <p className="starter-note">
        <Icon name="lock" size={12} />
        {storageUnavailable
          ? "ذخیره در مرورگر در دسترس نیست؛ ایده‌ات را کپی کن و پس از ورود ادامه بده."
          : "برای ساخت پروژه وارد حساب می‌شوی؛ ایده‌ات در همین مرورگر حفظ می‌شود."}
      </p>
    </div>
  );
}
