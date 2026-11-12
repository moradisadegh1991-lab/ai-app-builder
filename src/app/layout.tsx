import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Self-hosted at build time: no request to Google Fonts from the visitor's browser.
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-vazirmatn",
});

export const metadata: Metadata = {
  title: "Idea2App AI — از ایده تا محصول، با تیم هوش مصنوعی",
  description:
    "ایده‌ات را با تیمی از ایجنت‌های متخصص به وب‌سایت یا اپ Android تبدیل کن؛ از طراحی و کدنویسی تا ارزیابی و انتشار.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1612" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is replaced before first paint by THEME_INIT_SCRIPT, hence suppressHydrationWarning.
    <html lang="fa" dir="rtl" data-theme="light" className={vazirmatn.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
