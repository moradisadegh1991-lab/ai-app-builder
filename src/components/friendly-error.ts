/** Give users a useful next step while keeping provider responses and logs private. */
export function friendlyError(value: unknown): string {
  const message = typeof value === "string" ? value : value instanceof Error ? value.message : "";
  if (/402|اعتبار سرویس هوش مصنوعی|balance must be higher/i.test(message))
    return "اعتبار سرویس هوش مصنوعی کافی نیست. موجودی سرویس یا کلید شخصی را در بخش اتصال‌ها بررسی کنید و دوباره تلاش کنید.";
  if (/429|سقف مصرف|بودجهٔ باقی|سهمیه/i.test(message))
    return "سهمیهٔ هوش مصنوعی برای این درخواست کافی نیست. پس از آزاد شدن سهمیه یا تغییر تنظیمات، دوباره تلاش کنید.";
  if (/401|unauthorized|نشست.*منقضی/i.test(message))
    return "نشست شما پایان یافته است؛ دوباره وارد حساب شوید.";
  return "انجام این مرحله کامل نشد. لطفاً کمی بعد دوباره تلاش کنید؛ اگر مشکل ادامه داشت، اتصال‌ها و تنظیمات پروژه را بررسی کنید.";
}
