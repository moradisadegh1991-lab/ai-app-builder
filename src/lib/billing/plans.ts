import type { PlanId } from "../db/schema";

// Plans follow the shape of the ChatGPT / Claude / Gemini consumer plans:
// a free tier on economy models, and paid tiers at the familiar $20 / $100 /
// $200 price points with larger usage windows. Limits are counted in tokens
// (input + output) on the platform's central AI keys, over a rolling 5-hour
// window and a rolling 7-day window — like Claude's session and weekly limits.
// Users who add their own API key are not limited by tokens.
//
// Economics: on standard models a code generation costs roughly 15 USD per
// million tokens, so weekly limits are sized to keep the API cost of a fully
// used plan close to its price. Adjust here if prices or models change.

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  priceUsd: number;
  /** Max tokens in any rolling 5-hour window. */
  windowTokens: number;
  /** Max tokens in any rolling 7-day window. */
  weeklyTokens: number;
  /** economy = small fast models; standard = the providers' flagship models. */
  modelTier: "economy" | "standard";
  maxProjects: number | null;
  features: string[];
  highlighted?: boolean;
}

export const WINDOW_HOURS = 5;
export const PERIOD_DAYS = 30;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "رایگان",
    tagline: "برای امتحان کردن و اپ‌های کوچک",
    priceUsd: 0,
    windowTokens: 100_000,
    weeklyTokens: 300_000,
    modelTier: "economy",
    maxProjects: 2,
    features: [
      "مدل‌های اقتصادی (GPT-5 mini، Claude Haiku، Gemini Flash)",
      "۱۰۰ هزار توکن در هر ۵ ساعت، ۳۰۰ هزار در هفته",
      "۲ پروژه فعال",
      "ساخت APK و استقرار روی VPS",
    ],
  },
  plus: {
    id: "plus",
    name: "پلاس",
    tagline: "هم‌رده ChatGPT Plus و Claude Pro",
    priceUsd: 20,
    windowTokens: 150_000,
    weeklyTokens: 400_000,
    modelTier: "standard",
    maxProjects: 10,
    highlighted: true,
    features: [
      "مدل‌های اصلی (GPT-5، Claude Opus، Gemini Pro)",
      "۱۵۰ هزار توکن در هر ۵ ساعت، ۴۰۰ هزار در هفته",
      "۱۰ پروژه فعال",
      "اصلاح خودکار خطای Build",
    ],
  },
  pro: {
    id: "pro",
    name: "پرو",
    tagline: "هم‌رده Claude Max 5x",
    priceUsd: 100,
    windowTokens: 600_000,
    weeklyTokens: 2_000_000,
    modelTier: "standard",
    maxProjects: 50,
    features: ["همه امکانات پلاس", "۴ برابر پلاس در هر ۵ ساعت، ۵ برابر در هفته", "۵۰ پروژه فعال"],
  },
  max: {
    id: "max",
    name: "مکس",
    tagline: "هم‌رده ChatGPT Pro و Claude Max 20x",
    priceUsd: 200,
    windowTokens: 1_500_000,
    weeklyTokens: 5_000_000,
    modelTier: "standard",
    maxProjects: null,
    features: ["همه امکانات پرو", "۱۰ برابر پلاس در هر ۵ ساعت، ۱۲.۵ برابر در هفته", "پروژه نامحدود"],
  },
};

/** Token limits at or above this are shown as "unlimited". */
export const UNLIMITED_TOKENS = 1_000_000_000_000;

/** For developer accounts listed in UNLIMITED_EMAILS: flagship models, no token or project limits. */
export const DEVELOPER_PLAN: Plan = {
  id: "max",
  name: "توسعه‌دهنده",
  tagline: "حساب توسعه‌دهنده؛ بدون محدودیت",
  priceUsd: 0,
  windowTokens: UNLIMITED_TOKENS,
  weeklyTokens: UNLIMITED_TOKENS,
  modelTier: "standard",
  maxProjects: null,
  features: ["همه امکانات مکس", "بدون سقف توکن و پروژه"],
};

export const PAID_PLANS = (["plus", "pro", "max"] as const).map((id) => PLANS[id]);

export function isPaidPlan(value: string): value is Exclude<PlanId, "free"> {
  return value === "plus" || value === "pro" || value === "max";
}

/** Toman price, rounded to a thousand; null when the exchange rate is not configured. */
export function priceToman(plan: Plan, usdToToman: number): number | null {
  if (!usdToToman || usdToToman <= 0) return null;
  return Math.round((plan.priceUsd * usdToToman) / 1000) * 1000;
}
