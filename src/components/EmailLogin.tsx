"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

export function EmailLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ email: string }>("/api/auth/email/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSentTo(data.email);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
      <p className="mb-4 text-xs text-slate-500">بدون رمز عبور؛ یک کد ۶ رقمی به ایمیل شما فرستاده می‌شود.</p>
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
          <button className="btn-primary" disabled={busy || !email}>
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
