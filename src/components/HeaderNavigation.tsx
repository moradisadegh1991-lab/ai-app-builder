"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./ui/Icon";

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "پروژه‌ها", icon: "grid" },
  { href: "/guides", label: "راهنماها", icon: "book" },
  { href: "/settings", label: "اتصال‌ها", icon: "settings" },
  { href: "/pricing", label: "طرح‌ها", icon: "credit-card" },
];

function isActive(pathname: string, href: string) {
  // A project workspace belongs to "پروژه‌ها".
  if (href === "/dashboard" && pathname.startsWith("/projects/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNavigation({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname() || "";

  return (
    <nav
      aria-label={variant === "desktop" ? "منوی اصلی" : "منوی اصلی (موبایل)"}
      className={variant === "desktop" ? "hidden items-center gap-1 md:flex" : "no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-2 md:hidden"}
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className="nav-link shrink-0"
        >
          <Icon name={item.icon} size={16} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
