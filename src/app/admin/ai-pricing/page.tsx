import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { AdminPricingForm } from "@/components/AdminPricingForm";
import { environmentTariffs, isPricingAdmin } from "@/lib/ai/admin-pricing";
import { liaraCatalogPrice } from "@/lib/ai/liara-pricing";
import { db, schema } from "@/lib/db";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function AiPricingPage() {
  const user = await requirePageUser();
  if (!isPricingAdmin(user.id)) notFound();
  const [entries, pro, flash] = await Promise.all([
    db().select().from(schema.aiTariffs),
    liaraCatalogPrice("google/gemini-2.5-pro"),
    liaraCatalogPrice("google/gemini-2.5-flash"),
  ]);
  const stored = new Set(entries.map(entry => entry.key));
  const displayEntries = [...entries.map(entry => ({ key: entry.key, price: entry.price, source: "saved" as const })), ...environmentTariffs(process.env.LIARA_MODEL_PRICING_JSON).filter(entry => !stored.has(entry.key))];
  return <><Header user={user} /><main className="mx-auto max-w-3xl px-4 py-10" dir="rtl">
    <Link href="/settings" className="text-primary">بازگشت به تنظیمات</Link>
    <h1 className="mt-4 text-2xl font-bold">تعرفه هوش مصنوعی</h1>
    <p className="mt-3 text-muted">نرخ قراردادی حساب لیارا را به تومان برای هر میلیون توکن وارد کنید. برای هر مدل شناسه دقیق آن را ثبت کنید. تعرفه باید بالاترین نرخ ورودی و خروجی همه بازه‌های استفاده از مدل را پوشش دهد. نرخ‌ها پس از ۳۰ روز نیاز به تأیید مجدد دارند.</p>
    <div className="panel mt-6 p-5"><h2 className="font-bold">مرجع اولیه کاتالوگ عمومی لیارا</h2><p className="mt-2 text-sm text-muted">این قیمت‌ها دلاری و تقریبی‌اند، ممکن است نرخ حساب شما یا تعرفه ورودی طولانی متفاوت باشد و به‌صورت خودکار به تومان تبدیل یا تأیید نمی‌شوند.</p>
      {[{ name: "google/gemini-2.5-pro", price: pro }, { name: "google/gemini-2.5-flash", price: flash }].map(({name,price}) => <p key={name} className="mt-2" dir="ltr">{name}: {price ? `$${price.inputPerMillion} input / $${price.outputPerMillion} output per 1M` : "catalog unavailable"}</p>)}
    </div><AdminPricingForm initialEntries={displayEntries} />
  </main></>;
}
