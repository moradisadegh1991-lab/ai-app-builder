// src/lib/fa.ts of generated projects: Persian digits, numbers, money and Jalali (Solar Hijri) dates.
// No dependencies. Date conversion is done with the platform's Intl (ICU) data, so it follows the
// official calendar rules and needs no hand-written leap-year tables.
export const PERSIAN_HELPERS_PATH = "src/lib/fa.ts";

export const PERSIAN_HELPERS_SOURCE = `// Persian helpers: digits, numbers, toman and Jalali (Solar Hijri) dates. No dependencies.

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** 123 → "۱۲۳" (letters and symbols are kept). */
export function toFaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => FA_DIGITS[Number(digit)]!);
}

/** "۱۲۳" or "١٢٣" → "123", handy before parsing user input. */
export function toEnDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(FA_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(AR_DIGITS.indexOf(digit)));
}

/** 1234567 → "۱,۲۳۴,۵۶۷" */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR", { useGrouping: true }).format(value).replace(/٬/g, ",");
}

/** 1500000 → "۱,۵۰۰,۰۰۰ تومان" */
export function formatToman(value: number): string {
  return \`\${formatNumber(Math.round(value))} تومان\`;
}

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

export const WEEKDAYS_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] as const;

export interface JalaliDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

const partsFormat = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

function jalaliOfUtcDay(utcMs: number): JalaliDate {
  const parts = partsFormat.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const DAY_MS = 86_400_000;

/** The Jalali calendar day of a moment as seen in Tehran (UTC+3:30, no daylight saving since 2022). */
export function gregorianToJalali(date: Date | string | number = new Date()): JalaliDate {
  const instant = new Date(date).getTime();
  const tehranDay = Math.floor((instant + 3.5 * 3_600_000) / DAY_MS) * DAY_MS;
  return jalaliOfUtcDay(tehranDay);
}

/** Jalali y/m/d → the Gregorian date at 00:00 UTC of that day. */
export function jalaliToGregorian(year: number, month: number, day: number): Date {
  // Start from a close guess (1 Farvardin is around 21 March) and walk to the exact day.
  let ms = Date.UTC(year + 621, 2, 21) + Math.round(((month - 1) * 30.4 + (day - 1)) * DAY_MS);
  for (let step = 0; step < 40; step++) {
    const found = jalaliOfUtcDay(ms);
    const diff = (found.year - year) * 372 + (found.month - month) * 31 + (found.day - day);
    if (diff === 0) return new Date(ms);
    ms -= Math.sign(diff) * DAY_MS;
  }
  throw new Error("Invalid Jalali date");
}

/** 31 for the first six months, 30 for the next five, 29 or 30 for Esfand depending on the leap year. */
export function jalaliMonthLength(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  const lastSure = jalaliToGregorian(year, 12, 29).getTime();
  return jalaliOfUtcDay(lastSure + DAY_MS).month === 12 ? 30 : 29;
}

type DateStyle = "short" | "long" | "full" | "dateTime";

/**
 * Shows a date in the Jalali calendar with Persian digits (Tehran time).
 * short: ۱۴۰۵/۸/۷ · long: ۷ آبان ۱۴۰۵ · full: دوشنبه ۷ آبان ۱۴۰۵ · dateTime: ۱۴۰۵/۸/۷ ۱۸:۳۰
 */
export function formatJalali(date: Date | string | number, style: DateStyle = "short"): string {
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { year: "numeric", month: "numeric", day: "numeric" }
      : style === "long"
        ? { year: "numeric", month: "long", day: "numeric" }
        : style === "full"
          ? { weekday: "long", year: "numeric", month: "long", day: "numeric" }
          : { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false };
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { ...options, timeZone: "Asia/Tehran" }).format(new Date(date));
}
`;
