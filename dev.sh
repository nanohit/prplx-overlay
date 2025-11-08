#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d node_modules ]; then
  echo "[dev.sh] Installing dependencies..."
  npm install
fi

echo "[dev.sh] Starting Vite + Electron (app:dev)..."
npm run app:dev

