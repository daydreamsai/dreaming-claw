#!/usr/bin/env bash
set -euo pipefail

export DISPLAY=:1
export HOME="${AWAL_HOME:-/home/sandbox}"
export XDG_CONFIG_HOME="${HOME}/.config"
export XDG_CACHE_HOME="${HOME}/.cache"

AWAL_DIR="${HOME}/.local/share/awal/server"
AWAL_LOG="/tmp/awal-electron.log"
AWAL_INIT_TIMEOUT="${AWAL_INIT_TIMEOUT:-15}"

mkdir -p "${HOME}" "${XDG_CONFIG_HOME}" "${XDG_CACHE_HOME}"

# Start virtual framebuffer
Xvfb :1 -screen 0 1280x800x24 -ac -nolisten tcp &
XVFB_PID=$!
sleep 1

# Bootstrap awal server bundle if not already present
if [ ! -f "${AWAL_DIR}/.version" ]; then
  echo "[awal-entrypoint] bootstrapping awal server bundle..."
  npx awal@latest --version > /dev/null 2>&1 || true
  NPX_CACHE=$(find "${HOME}/.npm/_npx" -path '*/awal/server-bundle' -type d 2>/dev/null | head -1)
  if [ -z "${NPX_CACHE}" ]; then
    echo "[awal-entrypoint] ERROR: could not locate awal server-bundle in npx cache" >&2
    exit 1
  fi
  mkdir -p "${AWAL_DIR}"
  cp -r "${NPX_CACHE}/"* "${AWAL_DIR}/"
  cd "${AWAL_DIR}" && npm install --omit=dev
  AWAL_VERSION=$(npx awal@latest --version 2>/dev/null || echo "unknown")
  echo "${AWAL_VERSION}" > "${AWAL_DIR}/.version"
  echo "[awal-entrypoint] bootstrapped awal ${AWAL_VERSION}"
fi

# Remove stale lock file
rm -f /tmp/payments-mcp-ui.lock

# Start Electron headlessly
echo "[awal-entrypoint] starting awal Electron daemon..."
ELECTRON_DISABLE_SANDBOX=1 WALLET_STANDALONE=true \
  nohup xvfb-run --auto-servernum \
  "${AWAL_DIR}/node_modules/.bin/electron" \
  --no-sandbox --disable-gpu --disable-software-rasterizer \
  --disable-dev-shm-usage \
  "${AWAL_DIR}/bundle-electron.js" > "${AWAL_LOG}" 2>&1 &
ELECTRON_PID=$!

echo "[awal-entrypoint] waiting ${AWAL_INIT_TIMEOUT}s for Electron init (pid=${ELECTRON_PID})..."
sleep "${AWAL_INIT_TIMEOUT}"

# Verify Electron is still running
if ! kill -0 "${ELECTRON_PID}" 2>/dev/null; then
  echo "[awal-entrypoint] ERROR: Electron process died during init. Log:" >&2
  cat "${AWAL_LOG}" >&2
  exit 1
fi

echo "[awal-entrypoint] awal Electron daemon running (pid=${ELECTRON_PID})"

# Keep container alive — exit if Electron dies
wait "${ELECTRON_PID}"
