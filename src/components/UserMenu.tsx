"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./ui/Icon";

/**
 * Account button that discloses a few links (plan, settings, sign out). A disclosure, not an ARIA
 * "menu": the entries are ordinary links/buttons reachable with Tab. Closes on outside click and
 * Escape (focus returns to the button).
 */
export function UserMenu({
  displayName,
  email,
  avatarUrl,
  planName,
}: {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  planName: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 transition hover:bg-surface-3"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-8 rounded-full border border-line object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-fg" aria-hidden="true">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="sr-only">حساب کاربری {displayName}</span>
        <Icon name="chevron-down" size={14} className="hidden text-muted sm:block" />
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute end-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        >
          <div className="border-b border-line px-4 py-3">
            <div className="truncate text-sm font-semibold text-fg">{displayName}</div>
            <div className="ltr truncate text-xs text-muted">{email}</div>
            <span className="badge badge-brand mt-2">طرح {planName}</span>
          </div>
          <div className="p-1.5">
            <Link href="/pricing" className="nav-link w-full" onClick={() => setOpen(false)}>
              <Icon name="credit-card" size={16} />
              طرح‌ها و اشتراک
            </Link>
            <Link href="/settings" className="nav-link w-full" onClick={() => setOpen(false)}>
              <Icon name="settings" size={16} />
              اتصال‌ها و کلیدها
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="nav-link w-full text-danger-fg hover:!bg-danger-soft hover:!text-danger-fg">
                <Icon name="logout" size={16} />
                خروج
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
