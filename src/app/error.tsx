"use client";

export default function PageRecovery({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="page-container flex min-h-[60vh] items-center justify-center py-12" dir="rtl">
      <div className="panel max-w-lg p-6 text-center">
        <h1 className="text-xl font-bold">صفحه فعلاً آماده نیست</h1>
        <p className="mt-3 text-sm leading-7 text-muted">لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت، کمی بعد به این صفحه برگردید.</p>
        <button type="button" className="btn-primary mt-5" onClick={() => retry()}>تلاش دوباره</button>
      </div>
    </main>
  );
}
