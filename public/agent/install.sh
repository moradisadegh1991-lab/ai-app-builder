#!/usr/bin/env bash
# Idea2App AI — deploy agent installer for one Ubuntu/Debian server (VPS).
#
#   curl -fsSL https://<platform>/agent/install.sh | sudo IDEA2APP_URL=https://<platform> IDEA2APP_TOKEN=<token> bash
#
# The platform shows this exact command (with a one-time token) on the
# project page. What it sets up, and why:
#   - Node 22 in /opt/node            distro Node is too old for Vite 8.
#   - user `idea2app`                 builds and the API never run as root.
#   - an SSH deploy key               generated HERE; only the public half is sent
#                                     to the platform, which adds it to the GitHub
#                                     repository as a read-only deploy key.
#   - /etc/idea2app/agent.env         platform URL, agent secret, repository.
#   - /usr/local/bin/idea2app         the agent: pulls, builds, runs, reports.
#   - systemd timer idea2app-sync     checks GitHub every 2 minutes and deploys
#                                     each new commit automatically.
#   - Caddy                           HTTPS (Let's Encrypt) in front of everything,
#                                     on <ip>.sslip.io when there is no domain.
#   - PostgreSQL                      only when the project has a backend.
#
# Safe to run again. Optional settings: DOMAIN=example.com, NODE_MIRROR=<mirror>.
set -euo pipefail

PLATFORM="${IDEA2APP_URL:?IDEA2APP_URL is required}"
PLATFORM="${PLATFORM%/}"
TOKEN="${IDEA2APP_TOKEN:-}"
NODE_MIRROR="${NODE_MIRROR:-https://nodejs.org/dist}"
ETC=/etc/idea2app
DATA=/var/lib/idea2app
NODE_DIR=/opt/node
# GitHub's published ed25519 host key fingerprint.
GITHUB_FP="SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU"

say()  { printf '\n\033[1;36m== %s\033[0m\n' "$*" >&2; }
ok()   { printf '   [ ok ] %s\n' "$*" >&2; }
warn() { printf '   [ !! ] %s\n' "$*" >&2; }
die()  { printf '   [FAIL] %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "با root اجرا کنید (sudo)."
. /etc/os-release
case "${ID:-}" in ubuntu|debian) ;; *) warn "این نصب‌کننده برای Ubuntu/Debian است؛ اینجا $PRETTY_NAME است." ;; esac

# ── 1. system packages ────────────────────────────────────────────────────
say "۱. بسته‌های سیستم"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates openssh-client jq openssl xz-utils >/dev/null
if ! command -v caddy >/dev/null; then
  if ! apt-get install -y -qq caddy >/dev/null 2>&1; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy >/dev/null
  fi
fi
ok "git، curl، jq، caddy $(caddy version 2>/dev/null | cut -d' ' -f1)"

# ── 2. Node 22 ────────────────────────────────────────────────────────────
say "۲. Node.js 22"
if [ -x "$NODE_DIR/bin/node" ] && "$NODE_DIR/bin/node" -v | grep -q '^v22\.'; then
  ok "از قبل نصب است: $("$NODE_DIR/bin/node" -v)"
else
  arch=$(uname -m); case "$arch" in x86_64) arch=x64;; aarch64) arch=arm64;; *) die "معماری پشتیبانی‌نشده: $arch";; esac
  tmp=$(mktemp -d)
  curl -fsSL --retry 3 "$NODE_MIRROR/latest-v22.x/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt" \
    || die "به $NODE_MIRROR دسترسی نیست. با NODE_MIRROR=<آینه> دوباره اجرا کنید."
  file=$(grep -o "node-v22[^ ]*-linux-$arch.tar.xz" "$tmp/SHASUMS256.txt" | head -1)
  [ -n "$file" ] || die "نسخه لینوکس $arch پیدا نشد."
  curl -fsSL --retry 3 "$NODE_MIRROR/latest-v22.x/$file" -o "$tmp/$file"
  (cd "$tmp" && grep " $file\$" SHASUMS256.txt | sha256sum -c --quiet) || die "checksum فایل Node درست نیست."
  rm -rf "$NODE_DIR"; mkdir -p "$NODE_DIR"
  tar -xJf "$tmp/$file" -C "$NODE_DIR" --strip-components=1
  rm -rf "$tmp"
  ok "نصب شد: $("$NODE_DIR/bin/node" -v)"
fi
for b in node npm npx; do ln -sf "$NODE_DIR/bin/$b" /usr/local/bin/$b; done

# ── 3. swap: builds want about 2 GB of memory ─────────────────────────────
say "۳. حافظه"
mem_mb=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
swap_mb=$(awk '/SwapTotal/{print int($2/1024)}' /proc/meminfo)
if [ "$mem_mb" -lt 3500 ] && [ "$swap_mb" -lt 1024 ]; then
  [ -f /swapfile ] || { fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile >/dev/null; }
  swapon /swapfile 2>/dev/null || true
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "رم ${mem_mb}MB — ۲ گیگ swap اضافه شد"
else
  ok "رم ${mem_mb}MB، swap ${swap_mb}MB"
fi

# ── 4. user, directories, deploy key ──────────────────────────────────────
say "۴. کاربر idea2app و کلید استقرار"
id idea2app >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin idea2app
install -d -o idea2app -g idea2app -m 755 "$DATA" /opt/idea2app
install -d -o root -g idea2app -m 750 "$ETC"
if [ ! -f "$ETC/deploy_key" ]; then
  ssh-keygen -q -t ed25519 -N '' -C "idea2app@$(hostname)" -f "$ETC/deploy_key"
fi
chown idea2app:idea2app "$ETC/deploy_key" "$ETC/deploy_key.pub"; chmod 600 "$ETC/deploy_key"
ssh-keyscan -t ed25519 github.com 2>/dev/null > "$ETC/known_hosts.new"
fp=$(ssh-keygen -lf "$ETC/known_hosts.new" | awk '{print $2}')
[ "$fp" = "$GITHUB_FP" ] || die "کلید میزبان github.com با کلید رسمی GitHub یکی نیست ($fp)."
mv "$ETC/known_hosts.new" "$ETC/known_hosts"; chmod 644 "$ETC/known_hosts"
ok "کلید ساخته شد؛ فقط بخش عمومی آن به پلتفرم فرستاده می‌شود"

# ── 5. register with the platform ─────────────────────────────────────────
say "۵. اتصال به Idea2App"
ip=$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)
[ -n "$ip" ] || ip=$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p')
[ -n "$ip" ] || die "IP عمومی سرور پیدا نشد. با DOMAIN=<دامنه> دوباره اجرا کنید."
if [ -f "$ETC/agent.env" ] && [ -z "$TOKEN" ]; then
  ok "از قبل متصل است ($ETC/agent.env)"
else
  [ -n "$TOKEN" ] || die "IDEA2APP_TOKEN خالی است. دستور را از صفحه پروژه کپی کنید."
  body=$(jq -nc --arg token "$TOKEN" --arg key "$(cat "$ETC/deploy_key.pub")" --arg host "$(hostname)" --arg ip "$ip" \
    '{token: $token, publicKey: $key, hostname: $host, ip: $ip}')
  resp=$(curl -sS --max-time 60 -X POST "$PLATFORM/api/agent/register" -H 'content-type: application/json' -d "$body") \
    || die "به $PLATFORM دسترسی نیست."
  secret=$(printf '%s' "$resp" | jq -r '.secret // empty')
  [ -n "$secret" ] || die "ثبت ناموفق بود: $(printf '%s' "$resp" | jq -r '.error // .' 2>/dev/null)"
  domain="${DOMAIN:-${ip//./-}.sslip.io}"
  umask 027
  cat > "$ETC/agent.env" <<ENV
# Idea2App deploy agent. Written by install.sh.
PLATFORM=$PLATFORM
AGENT_SECRET=$secret
REPO=$(printf '%s' "$resp" | jq -r '.repo')
BRANCH=$(printf '%s' "$resp" | jq -r '.branch')
DOMAIN=$domain
ENV
  umask 022
  chown root:idea2app "$ETC/agent.env"; chmod 640 "$ETC/agent.env"
  ok "متصل شد: $(printf '%s' "$resp" | jq -r '.project')"
fi

# ── 6. agent command and auto-deploy timer ────────────────────────────────
say "۶. دستور idea2app و استقرار خودکار"
curl -fsSL "$PLATFORM/agent/idea2app" -o /usr/local/bin/idea2app.new
bash -n /usr/local/bin/idea2app.new || die "فایل agent دریافتی سالم نیست."
mv /usr/local/bin/idea2app.new /usr/local/bin/idea2app; chmod 755 /usr/local/bin/idea2app
cat > /etc/systemd/system/idea2app-sync.service <<'UNIT'
[Unit]
Description=Idea2App: deploy new commits from GitHub
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/idea2app sync
UNIT
cat > /etc/systemd/system/idea2app-sync.timer <<'UNIT'
[Unit]
Description=Idea2App: check GitHub for new commits every 2 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
RandomizedDelaySec=20s

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
ok "هر ۲ دقیقه GitHub بررسی و نسخه جدید خودکار مستقر می‌شود"

# ── 7. firewall: ports 80 and 443 ─────────────────────────────────────────
say "۷. فایروال"
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ok "ufw: پورت ۸۰ و ۴۴۳ باز شد"
fi
# Oracle Cloud's Ubuntu images ship iptables rules that reject everything but SSH.
if command -v iptables >/dev/null && iptables -S INPUT 2>/dev/null | grep -q -- '-j REJECT'; then
  for port in 80 443; do
    iptables -C INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null \
      || iptables -I INPUT 5 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
  done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null 2>&1 || true
  ok "iptables: پورت ۸۰ و ۴۴۳ باز شد"
fi

# ── 8. first deploy ───────────────────────────────────────────────────────
say "۸. اولین استقرار (چند دقیقه)"
if /usr/local/bin/idea2app deploy; then
  systemctl enable --now idea2app-sync.timer >/dev/null 2>&1
  say "تمام"
  ok "باز کنید: https://$(sed -n 's/^DOMAIN=//p' "$ETC/agent.env")"
else
  systemctl enable --now idea2app-sync.timer >/dev/null 2>&1
  warn "استقرار اول ناموفق بود؛ گزارش در صفحه پروژه و با «sudo idea2app log» دیده می‌شود."
  warn "بعد از اصلاح کد، هر Commit جدید خودکار دوباره مستقر می‌شود."
  exit 1
fi
echo "   راهنما: sudo idea2app help" >&2
