import ts from "typescript";
import { describe, expect, it } from "vitest";
import { PERSIAN_HELPERS_SOURCE } from "../src/lib/templates/persian";

// The helpers ship as source inside generated projects, so test the shipped text itself.
const js = ts.transpileModule(PERSIAN_HELPERS_SOURCE, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod: Record<string, any> = {};
new Function("exports", js)(mod);

describe("generated src/lib/fa.ts", () => {
  it("converts digits both ways", () => {
    expect(mod.toFaDigits("12:30 ab 9")).toBe("۱۲:۳۰ ab ۹");
    expect(mod.toEnDigits("۱۲۳ و ٤٥٦")).toBe("123 و 456");
  });

  it("formats numbers and toman with Persian digits", () => {
    expect(mod.formatNumber(1234567)).toBe("۱,۲۳۴,۵۶۷");
    expect(mod.formatToman(1500000.4)).toBe("۱,۵۰۰,۰۰۰ تومان");
  });

  it("converts known Gregorian days to Jalali", () => {
    expect(mod.gregorianToJalali(new Date("2026-03-21T12:00:00Z"))).toEqual({ year: 1405, month: 1, day: 1 });
    expect(mod.gregorianToJalali(new Date("2026-09-23T12:00:00Z"))).toEqual({ year: 1405, month: 7, day: 1 });
    expect(mod.gregorianToJalali(new Date("2025-03-20T12:00:00Z"))).toEqual({ year: 1403, month: 12, day: 30 });
  });

  it("uses the Tehran day, not the UTC day", () => {
    // 21:00 UTC on 20 March is already 00:30 on 21 March in Tehran.
    expect(mod.gregorianToJalali(new Date("2026-03-20T21:00:00Z"))).toEqual({ year: 1405, month: 1, day: 1 });
  });

  it("converts back and round-trips many days", () => {
    expect(mod.jalaliToGregorian(1405, 1, 1).toISOString().slice(0, 10)).toBe("2026-03-21");
    expect(mod.jalaliToGregorian(1403, 12, 30).toISOString().slice(0, 10)).toBe("2025-03-20");
    for (let day = 0; day < 1500; day += 7) {
      const date = new Date(Date.UTC(2024, 0, 1 + day, 12));
      const j = mod.gregorianToJalali(date);
      expect(mod.jalaliToGregorian(j.year, j.month, j.day).toISOString().slice(0, 10)).toBe(date.toISOString().slice(0, 10));
    }
  });

  it("knows month lengths including leap Esfand", () => {
    expect(mod.jalaliMonthLength(1405, 1)).toBe(31);
    expect(mod.jalaliMonthLength(1405, 7)).toBe(30);
    expect(mod.jalaliMonthLength(1403, 12)).toBe(30); // leap
    expect(mod.jalaliMonthLength(1404, 12)).toBe(29);
  });

  it("formats Jalali dates in Tehran time", () => {
    expect(mod.formatJalali("2026-03-21T12:00:00Z")).toBe("۱۴۰۵/۱/۱");
    expect(mod.formatJalali("2026-03-21T12:00:00Z", "long")).toBe("۱ فروردین ۱۴۰۵");
  });
});
