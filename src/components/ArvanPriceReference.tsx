import { arvanReference, arvanRoleRecommendations, estimateReferencePrice } from "@/lib/ai/arvan-reference";

const format = (n: number) => n.toLocaleString("fa-IR");
export function ArvanPriceReference() {
  return <section className="panel mt-6 p-6" aria-labelledby="arvan-prices-title">
    <h2 id="arvan-prices-title" className="text-lg font-bold">مدل‌ها و قیمت مرجع آروان</h2>
    <p className="mt-2 text-sm leading-7 text-muted">فهرست عمومی در تاریخ {arvanReference.retrievedAt} دریافت شده است؛ تعرفه‌ها ممکن است تغییر کنند. نام‌های جدول نمایشی‌اند؛ دو شناسه اعلام‌شده شما پیش‌فرض اولیه در حالت آروان هستند. فقط Gemini در درگاه شما آزمایش شده و کیفیت نقش‌ها هنوز باید بررسی شود. اعداد تومان برای هر یک میلیون توکن‌اند.</p>
    <h3 className="mt-5 font-bold">پیشنهاد اولیه برای هر نقش</h3>
    <p className="mt-1 text-sm text-muted">مثال هر مرحله: ۱۰ هزار توکن ورودی و ۳ هزار خروجی، بدون تصویر، گاردریل، تلاش مجدد یا مالیات.</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-start">نقش</th><th className="p-2 text-start">مدل پیشنهادی</th><th className="p-2 text-start">هزینه مثال</th></tr></thead><tbody>{arvanRoleRecommendations.map(item => <tr key={item.role} className="border-t border-line"><td className="p-2">{item.role}</td><td className="p-2" dir="ltr">{item.model}</td><td className="p-2">{(() => { const amount = estimateReferencePrice(item.model, 10000, 3000); return amount === null ? "نامشخص" : `${format(amount)} تومان`; })()}</td></tr>)}</tbody></table></div>
    <details className="mt-5"><summary className="cursor-pointer font-bold">نمایش فهرست {format(arvanReference.models.length)} مدل متنی</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-start">مدل</th><th className="p-2 text-start">ورودی</th><th className="p-2 text-start">خروجی</th></tr></thead><tbody>{arvanReference.models.map(item => <tr key={item.name} className="border-t border-line"><td className="p-2" dir="ltr">{item.name}</td><td className="p-2">{format(item.inputTomanPerMillion)}</td><td className="p-2">{format(item.outputTomanPerMillion)}</td></tr>)}</tbody></table></div></details>
    <a className="mt-4 inline-block text-primary" href={arvanReference.source} target="_blank" rel="noopener noreferrer">بررسی آخرین قیمت‌های آروان</a>
  </section>;
}
