"use client";

import { useState } from "react";
import { api } from "./api";

export function CheckoutButtons({
  plan,
  gateways,
  tomanPrice,
  usdPrice,
  loggedIn,
}: {
  plan: "plus" | "pro" | "max";
  gateways: ("zarinpal" | "stripe")[];
  tomanPrice: number | null;
  usdPrice: number;
  loggedIn: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <a href="/" className="btn-primary w-full">
        برای خرید وارد شوید
      </a>
    );
  }
  if (gateways.length === 0) {
    return <p className="text-xs text-muted">درگاه پرداخت هنوز روی این پلتفرم فعال نشده است.</p>;
  }

  async function pay(gateway: "zarinpal" | "stripe") {
    setBusy(gateway);
    setError(null);
    try {
      const { redirectUrl } = await api<{ redirectUrl: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan, gateway }),
      });
      window.location.href = redirectUrl;
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {gateways.includes("zarinpal") && tomanPrice && (
        <button className="btn-primary w-full" disabled={busy !== null} onClick={() => pay("zarinpal")}>
          {busy === "zarinpal" ? "انتقال به درگاه…" : `پرداخت ${tomanPrice.toLocaleString("fa-IR")} تومان (زرین‌پال)`}
        </button>
      )}
      {gateways.includes("stripe") && (
        <button className="btn-secondary w-full" disabled={busy !== null} onClick={() => pay("stripe")}>
          {busy === "stripe" ? "Redirecting…" : `پرداخت ${usdPrice.toLocaleString("fa-IR")} دلار (Stripe)`}
        </button>
      )}
      {error && <p className="text-xs text-danger-fg">{error}</p>}
    </div>
  );
}
