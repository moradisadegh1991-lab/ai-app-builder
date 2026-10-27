# Idea2App AI

پلتفرمی که ایده کاربر را با هوش مصنوعی (OpenAI، Claude، Gemini) به یک اپلیکیشن اندروید تبدیل می‌کند، سورس را در GitHub
کاربر ذخیره می‌کند، با GitHub Actions فایل APK می‌سازد و در صورت نیاز دیتابیس Neon و API روی Vercel راه‌اندازی می‌کند.

## جریان کار

```
ایده ──► نیازمندی‌ها (AI، قابل ویرایش و تأیید) ──► تولید کد (AI + قالب ثابت)
     ──► Repository خصوصی در GitHub کاربر (یک Commit)
     ──► GitHub Actions: npm build ► Gradle ► APK (Artifact + Release)
     ──► [Build ناموفق] ► لاگ خطا به AI ► اصلاح خودکار ► Build دوباره
     ──► [اختیاری] Neon (PostgreSQL + schema.sql) + Vercel (API) ► API_URL ► Build دوباره APK
```

| بخش | پیاده‌سازی |
| --- | --- |
| رابط کاربری و API | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4، فارسی و راست‌به‌چپ |
| دیتابیس پلتفرم | Neon PostgreSQL + Drizzle ORM (`src/lib/db/schema.ts`، Migration در `drizzle/`) |
| ورود و GitHub | GitHub OAuth (scopeها: `repo workflow read:user user:email`)؛ توکن رمزنگاری‌شده ذخیره می‌شود |
| هوش مصنوعی | `src/lib/ai`: لایه مشترک سه Provider، خروجی JSON اعتبارسنجی‌شده با Zod، ثبت مصرف توکن |
| کلیدهای AI | کلید مرکزی با سهمیه روزانه هر کاربر **یا** کلید شخصی کاربر (بدون سهمیه) |
| قالب اپ | React + Vite + Tailwind + **Capacitor 8** (پیش‌فرض) یا **React Native / Expo SDK 58** |
| Build | `.github/workflows/build-android.yml` در هر Repository تولیدشده + `scripts/ci-build-android.sh` |
| ابر (اختیاری) | Neon API (ساخت پروژه + اجرای `db/schema.sql`) و Vercel API (پروژه متصل به Repo + `DATABASE_URL`) |

### تصمیم‌های امنیتی

- همه توکن‌ها و کلیدها (GitHub، Vercel، Neon، کلید شخصی AI و Connection String دیتابیس‌ها) با **AES-256-GCM** رمزنگاری می‌شوند و
  هرگز به مرورگر برنمی‌گردند.
- دانلود APK از Repository خصوصی از طریق سرور انجام می‌شود (Redirect به لینک امضاشده کوتاه‌عمر GitHub).
- هوش مصنوعی فقط اجازه نوشتن در مسیرهای مجاز (`src/`، `App.tsx`، `api/`، `db/schema.sql`) را دارد؛ فایل‌های قالب، Workflow و
  `package.json` در اختیار پلتفرم است. مسیرهای مشکوک (`..`، مسیر مطلق) و فایل‌های بزرگ رد می‌شوند.
- کتابخانه‌های npm فقط از یک فهرست مجاز با نسخه‌های تست‌شده اضافه می‌شوند (`src/lib/templates/libraries.ts`).
- کوکی نشست امضاشده (JWT HS256)، `httpOnly` و `SameSite=Lax`؛ OAuth با پارامتر `state` در برابر CSRF محافظت می‌شود.

## راه‌اندازی محلی

پیش‌نیاز: Node.js 22 یا بالاتر.

```bash
npm install
cp .env.example .env.local      # ویندوز: Copy-Item .env.example .env.local
```

مقادیر `.env.local` را پر کنید:

1. **DATABASE_URL** — در [Neon](https://console.neon.tech) یک پروژه بسازید و Connection String (Pooled) را کپی کنید.
2. **ENCRYPTION_KEY** و **SESSION_SECRET** — هر کدام را جداگانه بسازید:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
3. **GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET** — در GitHub → Settings → Developer settings → OAuth Apps یک OAuth App بسازید:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/github/callback`
4. حداقل یکی از **OPENAI_API_KEY**، **ANTHROPIC_API_KEY**، **GEMINI_API_KEY** (یا بعداً کاربر کلید شخصی وارد کند).

ساخت جداول و اجرا:

```bash
npm run db:push     # یا اجرای drizzle/0000_init.sql روی دیتابیس
npm run dev
```

- برنامه: http://localhost:3000
- بررسی سلامت سرویس: http://localhost:3000/api/health

## استقرار روی Vercel

1. این Repository را در Vercel، Import کنید (Framework: Next.js).
2. همه متغیرهای `.env.example` را در Settings → Environment Variables وارد کنید و `APP_URL` را آدرس نهایی بگذارید
   (مثلاً `https://idea2app.vercel.app`).
3. در OAuth App گیت‌هاب، Callback URL را به `https://<domain>/api/auth/github/callback` تغییر دهید.
4. Routeهای تولید کد تا ۳۰۰ ثانیه اجرا می‌شوند (`maxDuration`)؛ Fluid Compute در Vercel باید فعال باشد (پیش‌فرض پروژه‌های جدید).

## پیش‌نیازهای کاربر نهایی

| قابلیت | نیاز |
| --- | --- |
| تولید اپ و APK | فقط ورود با GitHub (Actions برای Repositoryهای خصوصی سهمیه دقیقه رایگان ماهانه دارد) |
| استقرار API | توکن Vercel در صفحه «اتصال‌ها و کلیدها» + نصب اپ GitHub روی حساب Vercel با دسترسی به Repositoryها |
| دیتابیس | کلید API نئون کاربر، یا `NEON_API_KEY` مرکزی پلتفرم |

## نکات APK

- APK تولیدی با کلید **Debug** امضا شده و برای تست و نصب مستقیم است. برای Google Play باید Keystore انتشار در GitHub Secrets
  تعریف و مرحله `assembleRelease`/`bundleRelease` با امضای واقعی اضافه شود.
- پوشه `android/` در Repository نگه‌داری نمی‌شود و در هر Build با Capacitor/Expo Prebuild ساخته می‌شود؛ مجوزهای اندروید از
  `android-permissions.txt` (Capacitor) یا `app.json` (Expo) اعمال می‌شوند.

## توسعه

```bash
npm run typecheck
npm test                         # تست رمزنگاری، پارس خروجی AI و اعتبارسنجی/رندر قالب‌ها
npm run render:sample -- capacitor ./out/sample   # رندر یک پروژه نمونه بدون AI
```

Workflow `Template APK smoke test` هر دو قالب را با یک اپ نمونه رندر می‌کند و با همان اسکریپت Build پروژه‌های تولیدی، APK
واقعی می‌سازد؛ بنابراین هر تغییر در قالب‌ها پیش از Merge روی GitHub Actions آزمایش می‌شود.

## ساختار پوشه‌ها

```
src/
  app/                 صفحات (landing، dashboard، projects/[id]، settings) و API Routeها
  components/          رابط کاربری کلاینت (ProjectWorkspace، SettingsForm، …)
  lib/
    ai/                Providerها، Promptها، سهمیه و ثبت مصرف
    db/                Schema و اتصال Drizzle/Neon
    integrations/      GitHub، Vercel، Neon و ذخیره رمزنگاری‌شده اتصال‌ها
    templates/         قالب Capacitor، قالب Expo، Workflow و اعتبارسنجی فایل‌های AI
    pipeline.ts        Orchestrator: نیازمندی ► کد ► GitHub ► Build ► اصلاح ► ابر
scripts/               رندر پروژه نمونه برای Smoke test
drizzle/               Migration SQL
tests/                 تست‌های Vitest
```

## محدودیت‌های فعلی و گام‌های بعدی

- هر مرحله AI در یک درخواست HTTP اجرا می‌شود؛ برای مقیاس بالا بهتر است به صف کار (مثلاً Vercel Queues / Inngest) منتقل شود.
- ساخت AAB امضاشده برای Google Play، پلن‌های پولی و تیم‌های چندنفره هنوز پیاده‌سازی نشده‌اند.
- کیفیت کد تولیدی به مدل بستگی دارد؛ مسیر «اصلاح خودکار» خطاهای Build را با ارسال لاگ به مدل رفع می‌کند.
