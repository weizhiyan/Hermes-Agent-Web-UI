#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKEND="$ROOT/backend"
PORT="${PORT:-3381}"

if [ -f "$ROOT/.env" ]; then
  set -a
  . "$ROOT/.env"
  set +a
fi

if [ -f "$BACKEND/.env" ]; then
  set -a
  . "$BACKEND/.env"
  set +a
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js 18+ is required." >&2
  exit 1
fi

if [ ! -d "$BACKEND/node_modules" ]; then
  (cd "$BACKEND" && npm install)
fi

mkdir -p "$ROOT/logs"
echo "Hermes Agent is starting on http://127.0.0.1:$PORT/"
cd "$ROOT"
exec node backend/server.js

