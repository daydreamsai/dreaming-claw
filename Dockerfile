FROM node:22-bookworm

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

ARG OPENCLAW_DOCKER_APT_PACKAGES=""
ARG OPENCLAW_AWAL="false"
RUN apt-get update && \
    if [ "$OPENCLAW_AWAL" = "true" ]; then \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        libasound2 libatk-bridge2.0-0 libcairo2 libgbm1 libgtk-3-0 libnss3 \
        libpango-1.0-0 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
        xauth xvfb; \
    fi && \
    if [ -n "$OPENCLAW_DOCKER_APT_PACKAGES" ]; then \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $OPENCLAW_DOCKER_APT_PACKAGES; \
    fi && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
# Force pnpm for UI build (Bun may fail on ARM/Synology architectures)
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm ui:build

ENV NODE_ENV=production

# Allow non-root user to write temp files during runtime/tests.
RUN chown -R node:node /app

# Security hardening: Run as non-root user
# The node:22-bookworm image includes a 'node' user (uid 1000)
# This reduces the attack surface by preventing container escape via root privileges
USER node

# Pre-install awal server bundle (opt-in via --build-arg OPENCLAW_AWAL=true)
# Pin explicit version to avoid stale npx cache from Docker layer caching.
ARG AWAL_VERSION=2.0.3
ENV AWAL_DIR=/home/node/.local/share/awal/server
ENV AWAL_HOME=/home/node
RUN if [ "$OPENCLAW_AWAL" = "true" ]; then \
      npx "awal@${AWAL_VERSION}" --version > /dev/null 2>&1 || true \
      && NPX_CACHE=$(find /home/node/.npm/_npx -path '*/awal/server-bundle' -type d 2>/dev/null | head -1) \
      && if [ -z "${NPX_CACHE}" ]; then echo "ERROR: could not locate awal server-bundle" >&2; exit 1; fi \
      && mkdir -p "${AWAL_DIR}" \
      && cp -r "${NPX_CACHE}/"* "${AWAL_DIR}/" \
      && cd "${AWAL_DIR}" && npm install --omit=dev \
      && echo "${AWAL_VERSION}" > "${AWAL_DIR}/.version" \
      && echo "awal ${AWAL_VERSION} pre-installed"; \
    fi

# Start gateway server with default config.
# Binds to loopback (127.0.0.1) by default for security.
#
# For container platforms requiring external health checks:
#   1. Set OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD env var
#   2. Override CMD: ["node","openclaw.mjs","gateway","--allow-unconfigured","--bind","lan"]
#
# With OPENCLAW_AWAL=true, use the awal entrypoint which starts the Electron
# daemon before launching the gateway:
#   CMD ["bash", "scripts/gateway-awal-entrypoint.sh"]
CMD ["node", "openclaw.mjs", "gateway", "--allow-unconfigured"]
