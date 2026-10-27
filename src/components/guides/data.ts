import type { Mock } from "./MockScreen";

export interface GuideStep {
  title: string;
  body: string;
  mock: Mock;
  tip?: string;
}

export interface Guide {
  id: GuideId;
  title: string;
  summary: string;
  steps: GuideStep[];
}

export type GuideId =
  | "login"
  | "github"
  | "install-apk"
  | "own-vps"
  | "oracle"
  | "gcp"
  | "aws"
  | "vercel-neon"
  | "payment";

const PLATFORM = "idea2app.example";
const INSTALL_CMD = `curl -fsSL https://${PLATFORM}/agent/install.sh | sudo IDEA2APP_URL=https://${PLATFORM} IDEA2APP_TOKEN=i2a_reg_… bash`;
const CLOUD_INIT = `#!/bin/bash
curl -fsSL https://${PLATFORM}/agent/install.sh | IDEA2APP_URL=… IDEA2APP_TOKEN=… bash`;

// The last step of every VPS guide: the platform shows the server as online.
const vpsOnlineStep: GuideStep = {
  title: "منتظر بمانید تا وضعیت «فعال» شود",
  body: "نصب ۵ تا ۱۵ دقیقه طول می‌کشد. همین صفحه پروژه خودکار به‌روز می‌شود. وقتی وضعیت «فعال» شد، نشانی HTTPS سایت یا API را می‌بینید. از این به بعد هر Commit جدید ظرف ۲ دقیقه خودکار روی سرور مستقر می‌شود.",
  mock: {
    kind: "browser",
    url: `${PLATFORM}/projects/…`,
    body: [
      { t: "heading", label: "۴. اجرا روی سرور" },
      { t: "card", title: "سرور: 46.34.163.248", text: "Commit a1b2c3d · ۱ دقیقه پیش", badge: "فعال", hl: 1 },
      { t: "input", label: "نشانی", value: "https://46-34-163-248.sslip.io", mono: true, hl: 2 },
    ],
  },
};

export const GUIDES: Record<GuideId, Guide> = {
  login: {
    id: "login",
    title: "ثبت‌نام و ورود با کد ایمیل",
    summary: "بدون رمز عبور: یک کد ۶ رقمی به ایمیل شما فرستاده می‌شود.",
    steps: [
      {
        title: "ایمیل را وارد کنید",
        body: "در صفحه اول، ایمیل خود را بنویسید و «ارسال کد» را بزنید. اگر حساب ندارید، با همین کار ساخته می‌شود.",
        mock: {
          kind: "browser",
          url: PLATFORM,
          body: [
            { t: "heading", label: "ورود یا ثبت‌نام" },
            { t: "input", label: "ایمیل", value: "you@example.com", mono: true, hl: 1 },
            { t: "button", label: "ارسال کد", hl: 2 },
          ],
        },
      },
      {
        title: "کد را از ایمیل بردارید",
        body: "ایمیلی با عنوان «کد ورود Idea2App AI» می‌رسد. اگر در صندوق اصلی نبود، پوشه Spam را ببینید. کد ۱۰ دقیقه معتبر است.",
        mock: {
          kind: "phone",
          title: "Gmail",
          body: [
            { t: "card", title: "کد ورود Idea2App AI: 482913", text: "کد ورود شما به Idea2App AI…", hl: 1 },
            { t: "text", label: "این کد تا ۱۰ دقیقه معتبر است.", muted: true },
          ],
        },
      },
      {
        title: "کد را وارد کنید",
        body: "کد ۶ رقمی را وارد و «ورود» را بزنید. طرح رایگان خودکار برای شما فعال می‌شود.",
        mock: {
          kind: "browser",
          url: PLATFORM,
          body: [
            { t: "text", label: "کد به you@example.com فرستاده شد." },
            { t: "input", label: "کد ۶ رقمی", value: "482913", mono: true, hl: 1 },
            { t: "button", label: "ورود", hl: 2 },
          ],
        },
      },
    ],
  },

  github: {
    id: "github",
    title: "اتصال حساب GitHub",
    summary: "کد اپ در یک Repository خصوصی در حساب GitHub خودتان ذخیره و همان‌جا Build می‌شود.",
    steps: [
      {
        title: "اگر حساب GitHub ندارید، بسازید",
        body: "به github.com بروید و Sign up را بزنید. ایمیل، رمز و نام کاربری کافی است و طرح رایگان GitHub برای این کار بس است.",
        mock: {
          kind: "browser",
          url: "github.com/signup",
          body: [
            { t: "heading", label: "Create your free account" },
            { t: "input", label: "Email", value: "you@example.com", mono: true },
            { t: "input", label: "Password", value: "••••••••••", mono: true },
            { t: "button", label: "Continue", hl: 1 },
          ],
        },
      },
      {
        title: "در Idea2App «اتصال GitHub» را بزنید",
        body: "از منوی بالا وارد «اتصال‌ها و کلیدها» شوید و دکمه «اتصال GitHub» را بزنید.",
        mock: {
          kind: "browser",
          url: `${PLATFORM}/settings`,
          body: [
            { t: "heading", label: "اتصال‌ها و کلیدها" },
            { t: "card", title: "GitHub", text: "متصل نیست" },
            { t: "button", label: "اتصال GitHub", hl: 1 },
          ],
        },
      },
      {
        title: "در GitHub دسترسی را تأیید کنید",
        body: "GitHub می‌پرسد Idea2App اجازه ساخت Repository و اجرای Workflow داشته باشد یا نه. Authorize را بزنید. رمز GitHub شما هرگز به Idea2App داده نمی‌شود.",
        mock: {
          kind: "browser",
          url: "github.com/login/oauth/authorize",
          body: [
            { t: "heading", label: "Authorize Idea2App AI" },
            { t: "text", label: "Repositories — public and private" },
            { t: "text", label: "Workflow — update GitHub Action workflows" },
            { t: "button", label: "Authorize", hl: 1 },
          ],
        },
      },
      {
        title: "اتصال برقرار شد",
        body: "به Idea2App برمی‌گردید و کنار GitHub نام کاربری‌تان با برچسب «متصل» دیده می‌شود.",
        mock: {
          kind: "browser",
          url: `${PLATFORM}/settings?github=connected`,
          body: [{ t: "card", title: "GitHub", text: "@your-username", badge: "متصل", hl: 1 }],
        },
      },
    ],
  },

  "install-apk": {
    id: "install-apk",
    title: "نصب فایل APK روی گوشی اندروید",
    summary: "APK آزمایشی مستقیم نصب می‌شود؛ نیازی به Google Play نیست.",
    steps: [
      {
        title: "APK را دانلود کنید",
        body: "وقتی Build موفق شد، در صفحه پروژه روی «دانلود فایل APK» بزنید. بهتر است این کار را با مرورگر خود گوشی انجام دهید.",
        mock: {
          kind: "phone",
          title: "Idea2App — پروژه",
          body: [
            { t: "card", title: "Build #۳ — ✅ موفق", text: "my-app-build-3.apk · 4.1 MB" },
            { t: "button", label: "⬇️ دانلود فایل APK", hl: 1 },
          ],
        },
      },
      {
        title: "فایل دانلودشده را باز کنید",
        body: "بعد از دانلود، اعلان «دانلود کامل شد» را لمس کنید یا از برنامه Files به پوشه Download بروید و فایل .apk را باز کنید.",
        mock: {
          kind: "phone",
          title: "Files › Download",
          body: [{ t: "card", title: "my-app-build-3.apk", text: "4.1 MB · همین حالا", hl: 1 }],
        },
      },
      {
        title: "اجازه «نصب برنامه‌های ناشناس» را بدهید",
        body: "اندروید برای بار اول می‌پرسد. روی «تنظیمات» بزنید و گزینه «اجازه از این منبع» را برای مرورگر یا Files روشن کنید، سپس برگردید.",
        mock: {
          kind: "phone",
          title: "نصب برنامه‌های ناشناس",
          body: [
            { t: "text", label: "Chrome" },
            { t: "toggle", label: "اجازه از این منبع", on: true, hl: 1 },
            { t: "text", label: "نصب برنامه از منابع ناشناس ممکن است خطرناک باشد.", muted: true },
          ],
        },
        tip: "این APK با کلید آزمایشی (Debug) امضا شده است. برای انتشار در Google Play باید نسخه امضاشده ساخته شود.",
      },
      {
        title: "نصب و اجرا",
        body: "روی «نصب» بزنید. اگر Play Protect هشدار داد، «جزئیات بیشتر ← در هر صورت نصب شود» را بزنید. سپس «باز کردن».",
        mock: {
          kind: "phone",
          title: "اپ من",
          body: [
            { t: "text", label: "می‌خواهید این برنامه را نصب کنید؟" },
            { t: "row", items: [{ t: "button", label: "لغو", variant: "secondary" }, { t: "button", label: "نصب", hl: 1 }] },
          ],
        },
      },
    ],
  },

  "own-vps": {
    id: "own-vps",
    title: "استقرار روی VPS خودتان (با ایجنت)",
    summary:
      "یک دستور روی سرور اجرا می‌کنید. ایجنت کد را از GitHub می‌گیرد، Build می‌کند، با HTTPS اجرا می‌کند و هر Commit جدید را خودکار مستقر می‌کند.",
    steps: [
      {
        title: "سرور مناسب",
        body: "یک سرور Ubuntu 24.04 (یا 22.04 یا Debian 12) با دسترسی root، حداقل ۱ گیگ رم (۲ گیگ بهتر است) و ۱۰ گیگ فضای آزاد. پورت‌های ۲۲، ۸۰ و ۴۴۳ باید در پنل ارائه‌دهنده باز باشند.",
        mock: {
          kind: "browser",
          url: "panel.your-provider.com/servers",
          body: [
            { t: "card", title: "my-server · Ubuntu 24.04", text: "2 vCPU · 2 GB RAM · 40 GB · 46.34.163.248", badge: "Running", hl: 1 },
            { t: "card", title: "Firewall", text: "22, 80, 443 — Allow", hl: 2 },
          ],
        },
        tip: "دامنه لازم نیست: نشانی رایگان https://<IP-با-خط-تیره>.sslip.io خودکار ساخته می‌شود.",
      },
      {
        title: "دستور نصب را کپی کنید",
        body: "در صفحه پروژه، مرحله «اجرا روی سرور»، دکمه «ساخت دستور نصب» را بزنید و دستور را کپی کنید. این دستور یک توکن یک‌بارمصرف ۲۴ ساعته دارد.",
        mock: {
          kind: "browser",
          url: `${PLATFORM}/projects/…`,
          body: [
            { t: "heading", label: "۴. اجرا روی VPS خودتان" },
            { t: "button", label: "ساخت دستور نصب", hl: 1 },
            { t: "code", label: "این دستور را روی سرور اجرا کنید:", value: INSTALL_CMD, hl: 2 },
            { t: "button", label: "کپی", variant: "secondary" },
          ],
        },
      },
      {
        title: "با SSH به سرور وصل شوید",
        body: "در ویندوز PowerShell، در مک Terminal و روی گوشی برنامه Termux را باز کنید و با IP و رمز یا کلیدی که ارائه‌دهنده داده وارد شوید.",
        mock: {
          kind: "terminal",
          title: "PowerShell / Termux",
          lines: [
            { text: "ssh root@46.34.163.248", style: "hl" },
            { text: "root@46.34.163.248's password: ••••••••" },
            { text: "Welcome to Ubuntu 24.04 LTS", style: "ok" },
          ],
        },
      },
      {
        title: "دستور را Paste و اجرا کنید",
        body: "دستور کپی‌شده را Paste کنید و Enter بزنید. نصب‌کننده Node، Caddy و (در صورت نیاز) PostgreSQL را نصب می‌کند، کلید استقرار فقط‌خواندنی می‌سازد، کد را از GitHub می‌گیرد و Build می‌کند.",
        mock: {
          kind: "terminal",
          title: "root@my-server",
          lines: [
            { text: "curl -fsSL https://idea2app…/agent/install.sh | sudo … bash", style: "hl" },
            { text: "== ۱. بسته‌های سیستم" },
            { text: "== ۵. اتصال به Idea2App" },
            { text: "   [ ok ] متصل شد: اپ من", style: "ok" },
            { text: "== ۸. اولین استقرار (چند دقیقه)" },
            { text: "   [ ok ] باز کنید: https://46-34-163-248.sslip.io", style: "ok" },
          ],
        },
        tip: "دستورهای بعدی روی سرور: sudo idea2app status | deploy | log | logs",
      },
      vpsOnlineStep,
    ],
  },

  oracle: {
    id: "oracle",
    title: "VPS رایگان دائمی Oracle Cloud (Always Free)",
    summary:
      "بهترین VPS رایگان: سرور ARM تا ۲ هسته و ۱۲ گیگ رم (مطابق مستندات فعلی Oracle)، بدون تاریخ انقضا. Idea2App فقط یک اسکریپت می‌دهد که هنگام ساخت سرور در Oracle قرار می‌دهید؛ بقیه کار خودکار است.",
    steps: [
      {
        title: "ساخت حساب Oracle Cloud",
        body: "به oracle.com/cloud/free بروید و Start for free را بزنید. یک Home Region نزدیک انتخاب کنید (مثلاً Frankfurt یا Amsterdam). این Region بعداً قابل تغییر نیست.",
        mock: {
          kind: "browser",
          url: "signup.cloud.oracle.com",
          body: [
            { t: "heading", label: "Oracle Cloud Free Tier" },
            { t: "input", label: "Email", value: "you@example.com", mono: true },
            { t: "select", label: "Home Region", value: "Germany Central (Frankfurt)", hl: 1 },
            { t: "button", label: "Verify my email", hl: 2 },
          ],
        },
        tip: "Oracle برای تأیید هویت یک کارت بانکی بین‌المللی می‌خواهد (فقط تأیید است و هزینه‌ای کسر نمی‌شود). کارت‌های بانکی ایران پذیرفته نمی‌شوند.",
      },
      {
        title: "ساخت سرور: Create instance",
        body: "در کنسول، از منو به Compute ← Instances بروید و Create instance را بزنید.",
        mock: {
          kind: "browser",
          url: "cloud.oracle.com/compute/instances",
          sidebar: ["Home", "Compute", "Instances", "Networking", "Storage"],
          activeSide: 2,
          body: [{ t: "heading", label: "Instances" }, { t: "button", label: "Create instance", hl: 1 }],
        },
      },
      {
        title: "سیستم‌عامل و نوع سرور",
        body: "در بخش Image and shape، روی Edit بزنید. Image را Canonical Ubuntu 24.04 و Shape را از Ampere، VM.Standard.A1.Flex انتخاب کنید (حداکثر ۲ OCPU و ۱۲ گیگ رم در مجموع همه سرورهای A1، رایگان همیشگی).",
        mock: {
          kind: "browser",
          url: "cloud.oracle.com/compute/instances/create",
          body: [
            { t: "input", label: "Name", value: "idea2app-server", mono: true },
            { t: "select", label: "Image", value: "Canonical Ubuntu 24.04", hl: 1 },
            { t: "select", label: "Shape", value: "VM.Standard.A1.Flex · 2 OCPU · 12 GB · Always Free-eligible", hl: 2 },
          ],
        },
        tip: "اگر پیام Out of capacity دیدید، یک Availability Domain دیگر یا ۱ OCPU را امتحان کنید، یا چند ساعت بعد دوباره تلاش کنید. توجه: Oracle سروری را که ۷ روز پیوسته CPU، شبکه و حافظه‌اش همه زیر ۲۰٪ بماند ممکن است پس بگیرد؛ برای سایت کم‌بازدید این خطر هست.",
      },
      {
        title: "کلید SSH را ذخیره کنید",
        body: "در بخش Add SSH keys گزینه Generate a key pair را بگذارید و Save private key را بزنید. این فایل برای ورود دستی به سرور لازم است (برای نصب Idea2App لازم نیست).",
        mock: {
          kind: "browser",
          url: "cloud.oracle.com/compute/instances/create",
          body: [
            { t: "check", label: "Generate a key pair for me", on: true },
            { t: "button", label: "Save private key", variant: "secondary", hl: 1 },
          ],
        },
      },
      {
        title: "اسکریپت Idea2App را در Initialization script بگذارید",
        body: "پایین صفحه Show advanced options ← تب Management ← Initialization script ← Paste cloud-init script را بزنید و متنی را که Idea2App داده (دکمه «کپی اسکریپت cloud-init») Paste کنید. با این کار سرور در اولین روشن شدن خودش ایجنت را نصب می‌کند.",
        mock: {
          kind: "browser",
          url: "cloud.oracle.com/compute/instances/create",
          body: [
            { t: "tabs", items: ["Management", "Networking", "Image", "Placement"], active: 0, hl: 1 },
            { t: "check", label: "Paste cloud-init script", on: true },
            { t: "code", label: "Cloud-init script", value: CLOUD_INIT, hl: 2 },
            { t: "button", label: "Create", hl: 3 },
          ],
        },
      },
      {
        title: "باز کردن پورت ۸۰ و ۴۴۳",
        body: "بعد از ساخت، در صفحه سرور روی Subnet، سپس Security List پیش‌فرض بزنید و دو Ingress Rule اضافه کنید: Source CIDR برابر 0.0.0.0/0، پروتکل TCP و Destination Port برابر 80 و دوباره 443. فایروال داخلی خود سرور (iptables) را ایجنت خودکار باز می‌کند.",
        mock: {
          kind: "browser",
          url: "cloud.oracle.com/networking/vcns/…/security-lists",
          body: [
            { t: "heading", label: "Add Ingress Rules" },
            { t: "row", items: [{ t: "input", label: "Source CIDR", value: "0.0.0.0/0", mono: true }, { t: "select", label: "IP Protocol", value: "TCP" }] },
            { t: "input", label: "Destination Port Range", value: "80,443", mono: true, hl: 1 },
            { t: "button", label: "Add Ingress Rules", hl: 2 },
          ],
        },
      },
      vpsOnlineStep,
    ],
  },

  gcp: {
    id: "gcp",
    title: "VPS رایگان Google Cloud (e2-micro)",
    summary: "یک سرور کوچک e2-micro (۱ گیگ رم) در منطقه‌های آمریکا برای همیشه رایگان است. برای سایت‌ها و APIهای سبک کافی است.",
    steps: [
      {
        title: "ساخت حساب و پروژه",
        body: "به console.cloud.google.com بروید، با حساب Google وارد شوید و Free Trial را فعال کنید. یک پروژه جدید بسازید.",
        mock: {
          kind: "browser",
          url: "console.cloud.google.com",
          body: [{ t: "heading", label: "Google Cloud" }, { t: "button", label: "Start free", hl: 1 }],
        },
        tip: "Google هم برای تأیید هویت کارت بین‌المللی می‌خواهد. پس از پایان اعتبار آزمایشی، e2-micro همچنان رایگان می‌ماند.",
      },
      {
        title: "Create instance",
        body: "از منو Compute Engine ← VM instances ← Create instance. نام بدهید، Region را us-west1، us-central1 یا us-east1 و Machine type را e2-micro بگذارید.",
        mock: {
          kind: "browser",
          url: "console.cloud.google.com/compute/instancesAdd",
          body: [
            { t: "row", items: [{ t: "select", label: "Region", value: "us-central1", hl: 1 }, { t: "select", label: "Zone", value: "us-central1-a" }] },
            { t: "select", label: "Machine type", value: "e2-micro (2 vCPU, 1 GB)", hl: 2 },
          ],
        },
      },
      {
        title: "سیستم‌عامل و دیسک",
        body: "در Boot disk روی Change بزنید: Ubuntu، نسخه Ubuntu 24.04 LTS، نوع دیسک Standard persistent disk و اندازه 30 GB (سقف رایگان).",
        mock: {
          kind: "browser",
          url: "console.cloud.google.com/compute/instancesAdd",
          body: [
            { t: "select", label: "Operating system", value: "Ubuntu", hl: 1 },
            { t: "select", label: "Version", value: "Ubuntu 24.04 LTS (x86/64)" },
            { t: "row", items: [{ t: "select", label: "Boot disk type", value: "Standard persistent disk", hl: 2 }, { t: "input", label: "Size (GB)", value: "30" }] },
          ],
        },
      },
      {
        title: "باز کردن HTTP و HTTPS",
        body: "در بخش Firewall هر دو گزینه Allow HTTP traffic و Allow HTTPS traffic را تیک بزنید.",
        mock: {
          kind: "browser",
          url: "console.cloud.google.com/compute/instancesAdd",
          body: [
            { t: "heading", label: "Firewall" },
            { t: "check", label: "Allow HTTP traffic", on: true, hl: 1 },
            { t: "check", label: "Allow HTTPS traffic", on: true, hl: 2 },
          ],
        },
      },
      {
        title: "اسکریپت Idea2App را در Startup script بگذارید",
        body: "Advanced options ← Management ← Automation ← Startup script: اسکریپتی را که Idea2App داده Paste کنید، سپس Create را بزنید.",
        mock: {
          kind: "browser",
          url: "console.cloud.google.com/compute/instancesAdd",
          body: [
            { t: "heading", label: "Automation" },
            { t: "code", label: "Startup script", value: CLOUD_INIT, hl: 1 },
            { t: "button", label: "Create", hl: 2 },
          ],
        },
        tip: "Startup script در هر بار روشن شدن اجرا می‌شود. نصب‌کننده تکرارپذیر است و مشکلی ایجاد نمی‌کند، اما بعد از اولین نصب موفق می‌توانید آن را پاک کنید.",
      },
      vpsOnlineStep,
    ],
  },

  aws: {
    id: "aws",
    title: "VPS آمازون AWS (اعتبار رایگان حساب جدید)",
    summary: "حساب‌های جدید AWS اعتبار رایگان و طرح رایگان چندماهه دارند. سرورهای t3.micro و t4g.micro شامل آن می‌شوند.",
    steps: [
      {
        title: "Launch instance",
        body: "در کنسول AWS به EC2 ← Instances ← Launch instances بروید.",
        mock: {
          kind: "browser",
          url: "console.aws.amazon.com/ec2/home",
          sidebar: ["EC2 Dashboard", "Instances", "Security Groups"],
          activeSide: 1,
          body: [{ t: "button", label: "Launch instances", hl: 1 }],
        },
        tip: "AWS هم کارت بین‌المللی می‌خواهد. شرایط طرح رایگان AWS تغییر می‌کند؛ پیش از ساخت، برچسب Free tier eligible را ببینید.",
      },
      {
        title: "Ubuntu و نوع سرور",
        body: "در Application and OS Images گزینه Ubuntu Server 24.04 LTS و در Instance type یک نوع با برچسب Free tier eligible (مثل t3.micro) را انتخاب کنید. یک Key pair بسازید و دانلود کنید.",
        mock: {
          kind: "browser",
          url: "console.aws.amazon.com/ec2/home#LaunchInstances",
          body: [
            { t: "select", label: "AMI", value: "Ubuntu Server 24.04 LTS · Free tier eligible", hl: 1 },
            { t: "select", label: "Instance type", value: "t3.micro · Free tier eligible", hl: 2 },
          ],
        },
      },
      {
        title: "اجازه HTTP و HTTPS",
        body: "در Network settings تیک Allow HTTPS traffic from the internet و Allow HTTP traffic from the internet را بزنید.",
        mock: {
          kind: "browser",
          url: "console.aws.amazon.com/ec2/home#LaunchInstances",
          body: [
            { t: "check", label: "Allow SSH traffic from Anywhere", on: true },
            { t: "check", label: "Allow HTTPS traffic from the internet", on: true, hl: 1 },
            { t: "check", label: "Allow HTTP traffic from the internet", on: true, hl: 2 },
          ],
        },
      },
      {
        title: "اسکریپت Idea2App در User data",
        body: "Advanced details را باز کنید و در User data اسکریپت Idea2App را Paste کنید. سپس Launch instance را بزنید.",
        mock: {
          kind: "browser",
          url: "console.aws.amazon.com/ec2/home#LaunchInstances",
          body: [
            { t: "code", label: "User data", value: CLOUD_INIT, hl: 1 },
            { t: "button", label: "Launch instance", hl: 2 },
          ],
        },
      },
      vpsOnlineStep,
    ],
  },

  "vercel-neon": {
    id: "vercel-neon",
    title: "میزبانی رایگان خودکار: Vercel + Neon",
    summary:
      "ساده‌ترین مسیر رایگان، بدون نیاز به کارت بانکی: Idea2App پروژه Vercel و دیتابیس Neon را خودش می‌سازد و مستقر می‌کند. فقط دو کلید لازم است.",
    steps: [
      {
        title: "ساخت حساب Vercel و توکن",
        body: "در vercel.com با همان حساب GitHub ثبت‌نام کنید (طرح Hobby رایگان است). سپس به Account Settings ← Tokens بروید، Create را بزنید و توکن را کپی کنید.",
        mock: {
          kind: "browser",
          url: "vercel.com/account/settings/tokens",
          body: [
            { t: "heading", label: "Tokens" },
            { t: "input", label: "Token name", value: "idea2app", mono: true },
            { t: "select", label: "Expiration", value: "1 year" },
            { t: "button", label: "Create", hl: 1 },
            { t: "code", value: "vcp_xxxxxxxxxxxxxxxxxxxx", hl: 2 },
          ],
        },
      },
      {
        title: "دسترسی Vercel به GitHub",
        body: "در Vercel، Settings ← Git ← GitHub را باز کنید و اپ Vercel را با دسترسی All repositories نصب کنید تا Vercel بتواند Repositoryهای ساخته‌شده را Deploy کند.",
        mock: {
          kind: "browser",
          url: "github.com/apps/vercel/installations/new",
          body: [
            { t: "check", label: "All repositories", on: true, hl: 1 },
            { t: "button", label: "Install", hl: 2 },
          ],
        },
      },
      {
        title: "کلید API نئون",
        body: "در console.neon.tech ثبت‌نام کنید (رایگان)، به Account settings ← API keys بروید و Create new API key را بزنید.",
        mock: {
          kind: "browser",
          url: "console.neon.tech/app/settings/api-keys",
          body: [{ t: "button", label: "Create new API key", hl: 1 }, { t: "code", value: "napi_xxxxxxxxxxxxxxxx", hl: 2 }],
        },
      },
      {
        title: "کلیدها را در Idea2App ذخیره کنید",
        body: "در «اتصال‌ها و کلیدها» توکن Vercel و کلید Neon را Paste و ذخیره کنید. کلیدها رمزنگاری‌شده نگه‌داری می‌شوند.",
        mock: {
          kind: "browser",
          url: `${PLATFORM}/settings`,
          body: [
            { t: "input", label: "Vercel Access Token", value: "••••••••", mono: true, hl: 1 },
            { t: "input", label: "Neon API Key", value: "••••••••", mono: true, hl: 2 },
            { t: "button", label: "ذخیره" },
          ],
        },
      },
      {
        title: "استقرار با یک دکمه",
        body: "در صفحه پروژه، مرحله «اجرا روی سرور»، دکمه «ساخت دیتابیس Neon و استقرار روی Vercel» را بزنید. بعد از چند دقیقه نشانی ‎*.vercel.app‎ نمایش داده می‌شود.",
        mock: {
          kind: "browser",
          url: `${PLATFORM}/projects/…`,
          body: [
            { t: "button", label: "ساخت دیتابیس Neon و استقرار روی Vercel", hl: 1 },
            { t: "card", title: "وضعیت: ✅ فعال", text: "https://my-app.vercel.app", hl: 2 },
          ],
        },
      },
    ],
  },

  payment: {
    id: "payment",
    title: "خرید اشتراک",
    summary: "با کارت بانکی ایران (زرین‌پال، تومان) یا کارت بین‌المللی (Stripe، دلار). هر خرید ۳۰ روز اعتبار دارد.",
    steps: [
      {
        title: "طرح را انتخاب کنید",
        body: "از منوی بالا وارد «اشتراک» شوید. سقف‌های هر طرح (توکن در هر ۵ ساعت و در هفته) زیر نام آن نوشته شده است.",
        mock: {
          kind: "browser",
          url: `${PLATFORM}/pricing`,
          body: [
            {
              t: "row",
              items: [
                { t: "card", title: "رایگان", text: "۰ تومان" },
                { t: "card", title: "پلاس", text: "پیشنهادی", badge: "محبوب", hl: 1 },
                { t: "card", title: "پرو", text: "۵ برابر" },
              ],
            },
          ],
        },
      },
      {
        title: "روش پرداخت",
        body: "«پرداخت تومانی (زرین‌پال)» برای کارت‌های بانکی ایران است و «پرداخت دلاری (Stripe)» برای کارت‌های بین‌المللی.",
        mock: {
          kind: "browser",
          url: `${PLATFORM}/pricing`,
          body: [
            { t: "button", label: "پرداخت تومانی (زرین‌پال)", hl: 1 },
            { t: "button", label: "پرداخت دلاری (Stripe)", variant: "secondary", hl: 2 },
          ],
        },
      },
      {
        title: "پرداخت در درگاه",
        body: "در صفحه درگاه شماره کارت، CVV2، تاریخ انقضا و رمز دوم را وارد کنید. بعد از پرداخت خودکار به Idea2App برمی‌گردید.",
        mock: {
          kind: "browser",
          url: "payment.zarinpal.com/pg/StartPay/…",
          body: [
            { t: "input", label: "شماره کارت", value: "6037 •••• •••• ••••", mono: true },
            { t: "row", items: [{ t: "input", label: "CVV2", value: "•••" }, { t: "input", label: "رمز دوم", value: "••••••" }] },
            { t: "button", label: "پرداخت", hl: 1 },
          ],
        },
      },
      {
        title: "اشتراک فعال شد",
        body: "پیام «پرداخت موفق بود» نمایش داده می‌شود و طرح جدید همان لحظه فعال است. خرید دوباره همان طرح، ۳۰ روز به اعتبار فعلی اضافه می‌کند.",
        mock: {
          kind: "browser",
          url: `${PLATFORM}/pricing?payment=paid`,
          body: [{ t: "card", title: "✅ پرداخت موفق بود", text: "طرح پلاس تا ۳۰ روز دیگر فعال است", badge: "فعال", hl: 1 }],
        },
      },
    ],
  },
};
