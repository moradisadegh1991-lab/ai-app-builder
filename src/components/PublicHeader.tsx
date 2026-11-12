import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { Brand } from "./ui/Brand";

/** Header for signed-out visitors (landing, pricing). */
export function PublicHeader() {
  return (
    <header className="app-header public-header">
      <a href="#main-content" className="skip-link">
        رفتن به محتوای اصلی
      </a>
      <div className="page-container flex h-14 items-center gap-3">
        <Brand />
        <nav aria-label="منوی اصلی" className="ms-6 hidden items-center gap-1 sm:flex">
          <Link href="/#how" className="nav-link">
            چطور کار می‌کند؟
          </Link>
          <Link href="/#team" className="nav-link">
            تیم هوش مصنوعی
          </Link>
          <Link href="/pricing" className="nav-link">
            طرح‌ها
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <ThemeToggle compact />
          <Link href="/#login" className="btn-primary btn-sm">
            ورود / ثبت‌نام
          </Link>
        </div>
      </div>
    </header>
  );
}
