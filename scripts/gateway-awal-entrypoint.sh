#!/usr/bin/env bash
set -euo pipefail

export DISPLAY=:1
export AWAL_HOME="${AWAL_HOME:-/home/node}"
export XDG_CONFIG_HOME="${AWAL_HOME}/.config"
export XDG_CACHE_HOME="${AWAL_HOME}/.cache"

AWAL_DIR="${AWAL_HOME}/.local/share/awal/server"
AWAL_LOG="/tmp/awal-electron.log"
AWAL_INIT_TIMEOUT="${AWAL_INIT_TIMEOUT:-15}"

# Only start awal if it was pre-installed (opt-in via build arg)
if [ -f "${AWAL_DIR}/.version" ]; then
  echo "[gateway-awal] starting xvfb..."
  Xvfb :1 -screen 0 1280x800x24 -ac -nolisten tcp &
  sleep 1

  rm -f /tmp/payments-mcp-ui.lock

  echo "[gateway-awal] starting awal Electron daemon..."
  ELECTRON_DISABLE_SANDBOX=1 WALLET_STANDALONE=true \
    nohup xvfb-run --auto-servernum \
    "${AWAL_DIR}/node_modules/.bin/electron" \
    --no-sandbox --disable-gpu --disable-software-rasterizer \
    --disable-dev-shm-usage \
    "${AWAL_DIR}/bundle-electron.js" > "${AWAL_LOG}" 2>&1 &
  ELECTRON_PID=$!

  echo "[gateway-awal] waiting ${AWAL_INIT_TIMEOUT}s for Electron init (pid=${ELECTRON_PID})..."
  sleep "${AWAL_INIT_TIMEOUT}"

  if ! kill -0 "${ELECTRON_PID}" 2>/dev/null; then
    echo "[gateway-awal] ERROR: Electron died during init. Log:" >&2
    cat "${AWAL_LOG}" >&2
    exit 1
  fi

  echo "[gateway-awal] awal Electron daemon running (pid=${ELECTRON_PID})"
else
  echo "[gateway-awal] awal not installed, skipping daemon"
fi

# Start the gateway (pass through any extra args)
exec node dist/index.js gateway "$@"
