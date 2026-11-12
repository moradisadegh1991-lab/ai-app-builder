FROM node:22-bookworm-slim
# One browser keeps the runner small. Debian supplies Chromium and its sandbox libraries.
# No app or platform credentials are baked into this image.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-core ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --prefix /opt/runner --ignore-scripts --no-audit --no-fund playwright-core@1.58.2
ENV NODE_ENV=development CHROMIUM_PATH=/usr/bin/chromium
