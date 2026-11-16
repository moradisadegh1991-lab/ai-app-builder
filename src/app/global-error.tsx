"use client";

export default function GlobalRecovery({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#f5f8f5", color: "#17332c" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", boxSizing: "border-box" }}>
          <div style={{ maxWidth: "32rem", background: "white", borderRadius: "20px", padding: "32px", textAlign: "center" }}>
            <h1>پلتفرم فعلاً آماده نیست</h1>
            <p style={{ lineHeight: 2 }}>لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت، کمی بعد برگردید.</p>
            <button type="button" onClick={() => retry()} style={{ background: "#087a63", color: "white", border: 0, borderRadius: "10px", padding: "12px 24px", cursor: "pointer" }}>تلاش دوباره</button>
          </div>
        </main>
      </body>
    </html>
  );
}
