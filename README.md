# Idea2App AI

پلتفرمی که ایده کاربر را با هوش مصنوعی (OpenAI، Claude، Gemini) به **وب‌سایت** یا **اپ اندروید** تبدیل می‌کند. سورس در
GitHub خود کاربر ذخیره و با GitHub Actions ساخته می‌شود (APK یا Build سایت) و بسته به انتخاب کاربر، روی VPS خودش، یک VPS
رایگان یا Vercel + Neon اجرا می‌شود. هر مرحله آموزش تصویری دارد.

## جریان کار کاربر

```
ثبت‌نام با کد ایمیل (طرح رایگان خودکار)
  │
  ├─ «چه می‌خواهید بسازید؟»  وب‌سایت │ اپ اندروید
  │      اپ ─► «سرور لازم دارد؟»  فقط روی گوشی (محلی) │ با سرور و دیتابیس
  │
  ├─ (اگر سرور لازم است) «کجا اجرا شود؟»
  │      VPS خودم ─────► دستور یک‌خطی نصب ایجنت (SSH)
  │      VPS رایگان ───► Oracle / Google / AWS + آموزش تصویری + اسکریپت cloud-init
  │      Vercel + Neon ─► کاملاً خودکار، بدون کارت بانکی
  │
  ├─ نیازمندی‌ها (AI، قابل ویرایش و تأیید) ─► تولید کد (AI + قالب ثابت)
  ├─ Repository خصوصی در GitHub کاربر ─► GitHub Actions: APK یا Build سایت
  ├─ [خطا] لاگ Build یا لاگ استقرار سرور ─► اصلاح خودکار با AI ─► Commit و Build دوباره
  └─ استقرار: ایجنت VPS هر Commit جدید را خودکار مستقر می‌کند │ Vercel + Neon
     (برای اپ‌های دارای سرور، نشانی API در Build بعدی APK قرار می‌گیرد)
```

| بخش | پیاده‌سازی |
| --- | --- |
| رابط کاربری و API | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4، فارسی و راست‌به‌چپ |
| ورود | **Google**، **GitHub** یا کد ۶ رقمی ایمیل (Resend یا SMTP؛ ۱۰ دقیقه اعتبار، ۵ تلاش، محدودیت ارسال؛ فقط Hash کد ذخیره می‌شود) |
| اتصال GitHub | مرحله جدا و پس از ورود (`repo workflow`)؛ توکن رمزنگاری‌شده. ورود با GitHub فقط هویت را می‌خواند (`read:user user:email`) و توکن آن ذخیره نمی‌شود |
| هوش مصنوعی | `src/lib/ai`: سه Provider، خروجی JSON با Zod، ثبت مصرف توکن |
| اشتراک | رایگان / پلاس / پرو / مکس با سقف توکن در پنجره ۵ ساعته و ۷ روزه؛ مدل‌های اقتصادی در طرح رایگان |
| پرداخت | زرین‌پال (تومان) و Stripe Checkout (دلار) + Webhook امضاشده |
| قالب‌ها | وب‌سایت (React + Vite + Tailwind)، Capacitor 8 (اندروید)، Expo SDK 58 (اندروید) |
| بک‌اند اپ‌ها | Hono + PostgreSQL (postgres.js)؛ همان کد روی VPS (Node + systemd) و روی Vercel (Function) |
| ایجنت VPS | `public/agent/install.sh` + دستور `idea2app` (الگوی ایجنت پروژه EPC) |
| دیتابیس پلتفرم | PostgreSQL + Drizzle (Neon با درایور HTTP، هر PostgreSQL دیگر با TCP) |

### طرح‌ها (`src/lib/billing/plans.ts`)

| طرح | قیمت | هر ۵ ساعت | هر هفته | مدل‌ها | پروژه |
| --- | --- | --- | --- | --- | --- |
| رایگان | ۰ | ۱۰۰ هزار توکن | ۳۰۰ هزار | اقتصادی (GPT-5 mini، Claude Haiku، Gemini Flash) | ۲ |
| پلاس | ۲۰ دلار | ۱۵۰ هزار | ۴۰۰ هزار | اصلی (GPT-5، Claude Opus، Gemini Pro) | ۱۰ |
| پرو | ۱۰۰ دلار | ۶۰۰ هزار | ۲ میلیون | اصلی | ۵۰ |
| مکس | ۲۰۰ دلار | ۱.۵ میلیون | ۵ میلیون | اصلی | نامحدود |

- الگو گرفته از ChatGPT (Free/Plus/Pro)، Claude (Free/Pro/Max 5x/Max 20x) و Gemini. سقف هفتگی طوری تنظیم شده که هزینه API
  یک طرح کاملاً مصرف‌شده نزدیک قیمت آن بماند. اعداد را در همین فایل تغییر دهید.
- قیمت تومانی = قیمت دلاری × `USD_TO_TOMAN` (گرد به هزار تومان).
- هر خرید ۳۰ روز اعتبار دارد و تمدید خودکار ندارد. خرید دوباره همان طرح اعتبار را تمدید و خرید طرح دیگر از همان لحظه جایگزین
  می‌کند.
- سقف‌ها فقط برای کلیدهای مرکزی است؛ کاربری که کلید API شخصی وارد کند محدودیت توکن ندارد (سقف تعداد پروژه می‌ماند).

### ایجنت VPS

کاربر در صفحه پروژه «ساخت دستور نصب» را می‌زند و این دستور را روی سرور اجرا می‌کند:

```bash
curl -fsSL https://<platform>/agent/install.sh | sudo IDEA2APP_URL=https://<platform> IDEA2APP_TOKEN=<one-time> bash
```

برای VPS رایگان همین را به‌صورت اسکریپت cloud-init می‌گیرد و هنگام ساخت سرور در Oracle (Initialization script)، Google
(Startup script) یا AWS (User data) قرار می‌دهد؛ سرور در اولین روشن شدن خودش نصب می‌شود.

نصب‌کننده:

1. Node 22 (با بررسی checksum)، Caddy، swap روی سرورهای کم‌رم، کاربر سیستمی `idea2app` را نصب می‌کند.
2. **کلید SSH را روی خود سرور می‌سازد**؛ فقط کلید عمومی با توکن یک‌بارمصرف (۲۴ ساعته) به پلتفرم فرستاده می‌شود و پلتفرم آن را
   به‌عنوان **Deploy key فقط‌خواندنی** به Repository اضافه می‌کند. کلید میزبان github.com با اثرانگشت رسمی بررسی می‌شود.
3. یک secret دائمی برای گزارش وضعیت می‌گیرد (فقط Hash آن در پلتفرم ذخیره می‌شود).
4. کد را می‌گیرد و طبق `idea2app.json` مستقر می‌کند: Build سایت در `dist/` و سرو با Caddy؛ برای بک‌اند PostgreSQL، اجرای
   `db/schema.sql` و سرویس systemd `idea2app-app` (پشت Caddy روی `/api`).
5. HTTPS خودکار روی دامنه دلخواه (`DOMAIN=`) یا `‎<ip>.sslip.io` (و نام دوم `nip.io`).
6. تایمر `idea2app-sync` هر ۲ دقیقه GitHub را بررسی و هر Commit جدید را مستقر می‌کند. Commitی که شکست بخورد دوباره تلاش
   نمی‌شود تا Commit بعدی برسد. هر تیک یک heartbeat به پلتفرم می‌فرستد.

روی سرور: `sudo idea2app status | deploy | log | logs | restart`. فایروال Oracle (iptables) و ufw خودکار باز می‌شوند.

### امنیت

- همه توکن‌ها و کلیدها (GitHub، Vercel، Neon، کلید شخصی AI، Connection String دیتابیس‌ها) با **AES-256-GCM** رمزنگاری
  می‌شوند و هرگز به مرورگر برنمی‌گردند. کد ورود، توکن نصب و secret ایجنت فقط به‌صورت Hash ذخیره می‌شوند.
- دانلود APK از Repository خصوصی از طریق سرور انجام می‌شود (لینک امضاشده کوتاه‌عمر GitHub).
- هوش مصنوعی فقط در مسیرهای مجاز (`src/`، `App.tsx`، `public/`، `server/`، `db/schema.sql`) می‌نویسد. فایل‌های قالب، Workflow،
  `package.json`، `server/base.ts|db.ts|node.ts` و `api/index.ts` در اختیار پلتفرم است. کتابخانه‌های npm فقط از فهرست مجاز
  اضافه می‌شوند.
- پرداخت‌ها سمت سرور تأیید می‌شوند (verify زرین‌پال، بازخوانی Checkout Session و امضای Webhook در Stripe) و هر پرداخت فقط
  یک بار اشتراک فعال می‌کند.

### ورود با Google و GitHub

- حساب‌ها با **ایمیل تأییدشده** یکی می‌شوند: کسی که با کد ایمیل ثبت‌نام کرده و بعد با Google یا GitHub همان ایمیل وارد شود، همان حساب را می‌بیند. ایمیل تأییدنشده هرگز برای ادغام استفاده نمی‌شود و ورود رد می‌شود.
- GitHub ایمیل اصلی تأییدشده را حتی وقتی در پروفایل پنهان است برمی‌گرداند؛ آدرس `noreply` پذیرفته نمی‌شود.
- دکمه Google فقط وقتی دیده می‌شود که `GOOGLE_CLIENT_ID` و `GOOGLE_CLIENT_SECRET` تنظیم باشند.
- ساخت کلید Google: Google Cloud Console ← APIs & Services ← **OAuth consent screen** (نوع External، نام برنامه و ایمیل پشتیبانی؛ scopeهای `openid`، `email`، `profile`) ← **Credentials ← Create credentials ← OAuth client ID ← Web application** با Authorized redirect URI برابر `https://<دامنه>/api/auth/google/callback`. تا وقتی برنامه در حالت Testing است فقط کاربران تست‌شده وارد می‌شوند؛ برای همه، Publish app را بزنید.

## راه‌اندازی محلی

پیش‌نیاز: Node.js 22 و یک PostgreSQL (Neon یا محلی).

```bash
npm install
cp .env.example .env.local      # ویندوز: Copy-Item .env.example .env.local
```

در `.env.local` حداقل این‌ها را پر کنید: `DATABASE_URL`، `ENCRYPTION_KEY`، `SESSION_SECRET` (هر کدام با
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)، `GITHUB_CLIENT_ID/SECRET` (OAuth App با
Callback `http://localhost:3000/api/auth/github/callback`) و یک کلید AI. در حالت توسعه، اگر سرویس ایمیل تنظیم نشده باشد،
کد ورود در ترمینال چاپ می‌شود.

```bash
npm run db:push     # یا روی دیتابیس خالی: کل drizzle/all-in-one.sql را در SQL Editor نئون اجرا کنید (Read-only خاموش)
npm run dev
```

بررسی سلامت: http://localhost:3000/api/health

## استقرار پلتفرم روی Vercel

1. Repository را در Vercel Import کنید (Framework: Next.js) و Fluid Compute را فعال نگه دارید (Routeهای AI تا ۳۰۰ ثانیه).
2. متغیرهای `.env.example` را وارد کنید و `APP_URL` را نشانی نهایی بگذارید.
3. Callback در OAuth App گیت‌هاب: `https://<domain>/api/auth/github/callback`.
4. زرین‌پال: Callback خودکار `https://<domain>/api/billing/zarinpal/callback` است (دامنه باید در پنل زرین‌پال ثبت باشد).
5. Stripe: Webhook با رویداد `checkout.session.completed` روی `https://<domain>/api/billing/stripe/webhook`.

خود پلتفرم را روی VPS هم می‌توان اجرا کرد: با PostgreSQL محلی (درایور TCP خودکار انتخاب می‌شود)، `npm run build` و
`npm start` پشت Caddy.

## توسعه و تست

```bash
npm run typecheck
npm test                                              # رمزنگاری، پارس AI، قالب‌ها، طرح‌ها، امضای Stripe، ایجنت
npm run render:sample -- web ./out/site --backend    # رندر پروژه نمونه بدون AI
```

Workflow `Template smoke test` روی GitHub Actions:

- APK واقعی از قالب‌های Capacitor (با و بدون بک‌اند) و Expo، و Build سایت را با همان اسکریپت پروژه‌های تولیدی می‌سازد.
- اسکریپت‌های ایجنت را با ShellCheck بررسی می‌کند.
- **ایجنت را انتها‌به‌انتها روی یک Ubuntu واقعی نصب می‌کند** (با یک پلتفرم ساختگی و مخزن محلی) و بررسی می‌کند سایت، API و
  PostgreSQL از HTTPS جواب می‌دهند و Commit جدید خودکار مستقر می‌شود.

## ساختار پوشه‌ها

```
public/agent/          نصب‌کننده و دستور idea2app (ایجنت VPS)
src/
  app/                 صفحات (ورود، داشبورد، پروژه، اشتراک، آموزش‌ها، تنظیمات) و API Routeها
  components/          رابط کاربری؛ guides/ = آموزش‌های تصویری (MockScreen + داده مراحل)
  lib/
    ai/                Providerها، Promptها، اعمال سقف طرح و ثبت مصرف
    auth/              کد ورود ایمیلی
    billing/           طرح‌ها، سقف مصرف، زرین‌پال و Stripe
    agent/             ثبت ایجنت، Deploy key، گزارش وضعیت
    integrations/      GitHub، Vercel، Neon و ذخیره رمزنگاری‌شده اتصال‌ها
    templates/         قالب وب‌سایت، Capacitor، Expo، بک‌اند Hono و اعتبارسنجی فایل‌های AI
    pipeline.ts        Orchestrator: نیازمندی ► کد ► GitHub ► Build ► اصلاح ► استقرار
scripts/               رندر پروژه نمونه و پلتفرم ساختگی برای تست ایجنت
drizzle/               Migrationها
tests/                 تست‌های Vitest
```

## محدودیت‌ها

- هر مرحله AI در یک درخواست HTTP اجرا می‌شود (تا ۳۰۰ ثانیه)؛ برای مقیاس بالا بهتر است به صف کار منتقل شود.
- APKها با کلید Debug امضا می‌شوند؛ نسخه امضاشده برای Google Play هنوز پیاده نشده است.
- Oracle، Google و AWS برای ثبت‌نام کارت بانکی بین‌المللی می‌خواهند؛ Vercel + Neon بدون کارت کار می‌کند.
- آموزش‌های تصویری تصاویر نمادین‌اند (نه اسکرین‌شات واقعی) و ممکن است با تغییر ظاهر کنسول این سرویس‌ها کمی متفاوت شوند.
