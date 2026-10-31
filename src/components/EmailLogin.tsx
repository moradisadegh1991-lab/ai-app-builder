"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { Turnstile } from "./Turnstile";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-5" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function EmailLogin({
  providers,
  turnstileSiteKey,
}: {
  providers: { google: boolean; github: boolean };
  /** When set, a Cloudflare Turnstile check is required before a code is sent. */
  turnstileSiteKey?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Tokens are single use: remounting the widget after each attempt gives a fresh one.
  const [widgetKey, setWidgetKey] = useState(0);

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ email: string }>("/api/auth/email/request", {
        method: "POST",
        body: JSON.stringify({ email, turnstileToken: turnstileToken ?? undefined }),
      });
      setSentTo(data.email);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (turnstileSiteKey) {
        setTurnstileToken(null);
        setWidgetKey((key) => key + 1);
      }
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/email/verify", { method: "POST", body: JSON.stringify({ email: sentTo, code }) });
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="card w-full max-w-sm text-start">
      <h2 className="mb-1 text-lg font-bold">ورود یا ثبت‌نام</h2>
      <p className="mb-4 text-xs text-slate-500">بدون رمز عبور؛ با Google، GitHub یا کد ۶ رقمی ایمیل.</p>
      {(providers.google || providers.github) && !sentTo && (
        <>
          <div className="flex flex-col gap-2">
            {providers.google && (
              <a href="/api/auth/google/login" className="btn-secondary w-full">
                <GoogleIcon />
                ادامه با Google
              </a>
            )}
            {providers.github && (
              <a href="/api/auth/github/login" className="btn-secondary w-full">
                <GitHubIcon />
                ادامه با GitHub
              </a>
            )}
          </div>
          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            یا با ایمیل
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
        </>
      )}
      {!sentTo ? (
        <form onSubmit={requestCode} className="flex flex-col gap-3">
          <label className="label" htmlFor="email">
            ایمیل
          </label>
          <input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {turnstileSiteKey && <Turnstile key={widgetKey} siteKey={turnstileSiteKey} onToken={setTurnstileToken} />}
          <button className="btn-primary" disabled={busy || !email || (Boolean(turnstileSiteKey) && !turnstileToken)}>
            {busy ? "در حال ارسال…" : "ارسال کد"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p className="text-sm">
            کد به <span dir="ltr" className="font-mono">{sentTo}</span> فرستاده شد. پوشه Spam را هم ببینید.
          </p>
          <label className="label" htmlFor="code">
            کد ۶ رقمی
          </label>
          <input
            id="code"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="input text-center font-mono text-xl tracking-[0.5em]"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
          />
          <button className="btn-primary" disabled={busy || code.length !== 6}>
            {busy ? "در حال بررسی…" : "ورود"}
          </button>
          <div className="flex justify-between text-xs">
            <button type="button" className="text-slate-500 hover:underline" onClick={() => setSentTo(null)}>
              تغییر ایمیل
            </button>
            <button type="button" className="text-brand-600 hover:underline" disabled={busy} onClick={() => requestCode()}>
              ارسال دوباره کد
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
