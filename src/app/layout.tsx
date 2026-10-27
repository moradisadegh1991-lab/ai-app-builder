import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Idea2App AI — ایده به اپلیکیشن اندروید",
  description: "ایده‌ات را بنویس؛ هوش مصنوعی اپ اندروید می‌سازد، در GitHub ذخیره می‌کند و فایل APK تحویل می‌دهد.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
