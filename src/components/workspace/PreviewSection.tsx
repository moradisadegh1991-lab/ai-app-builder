"use client";

import { useState } from "react";
import { Icon } from "../ui/Icon";
import { ExternalLink, Section } from "./parts";

type Device = "desktop" | "tablet" | "mobile";

const WIDTHS: Record<Device, string> = { desktop: "100%", tablet: "48rem", mobile: "24rem" };

/** The deployed website in a sandboxed frame, with a device width switch. */
export function PreviewSection({ url }: { url: string }) {
  const [device, setDevice] = useState<Device>("desktop");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <Section
      icon="eye"
      title="پیش‌نمایش زنده"
      description="نسخهٔ منتشرشدهٔ سایت؛ پس از هر استقرار جدید به‌روز می‌شود."
      actions={
        <>
          <div className="segmented" role="group" aria-label="اندازهٔ صفحه">
            {(
              [
                ["desktop", "monitor", "دسکتاپ"],
                ["tablet", "grid", "تبلت"],
                ["mobile", "smartphone", "موبایل"],
              ] as const
            ).map(([value, icon, label]) => (
              <button key={value} type="button" aria-pressed={device === value} onClick={() => setDevice(value)} title={label}>
                <Icon name={icon} size={15} />
                <span className="sr-only sm:not-sr-only">{label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setReloadKey((value) => value + 1)}>
            <Icon name="refresh" size={14} />
            بارگذاری مجدد
          </button>
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2" dir="ltr">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-surface-2 px-2.5 py-1 font-mono text-xs text-muted">{url}</span>
          <ExternalLink href={url} className="text-xs">
            Open
          </ExternalLink>
        </div>
        <div className="flex justify-center p-3">
          <iframe
            key={reloadKey}
            src={url}
            title="پیش‌نمایش نسخهٔ منتشرشدهٔ سایت"
            sandbox="allow-scripts allow-forms allow-popups"
            referrerPolicy="no-referrer"
            className="h-[38rem] max-h-[75dvh] rounded-lg border border-line bg-white shadow-xs transition-[width] duration-300"
            style={{ width: WIDTHS[device], maxWidth: "100%" }}
          />
        </div>
      </div>
    </Section>
  );
}
