#!/usr/bin/env bash
# Start the MCP server and the Next.js web app together, wired through
# MCP_SERVER_URL so the web app gets the full Peapix archive locally.
#
# Usage:   ./run_local.sh
# Stop:    Ctrl+C  (both processes are killed)
#
# Requires: uv, Node 20+, an OPENAI_API_KEY in web-app/.env.local

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

MCP_PORT="${MCP_PORT:-8080}"
WEB_PORT="${WEB_PORT:-3000}"

# If a requested port is busy, walk forward until we find a free one.
find_free_port() {
  local port="$1"
  while lsof -ti:"$port" >/dev/null 2>&1; do
    port=$((port + 1))
  done
  echo "$port"
}

NEW_MCP_PORT=$(find_free_port "$MCP_PORT")
if [ "$NEW_MCP_PORT" != "$MCP_PORT" ]; then
  echo "⚠️  Port $MCP_PORT busy — using $NEW_MCP_PORT for MCP server."
  MCP_PORT="$NEW_MCP_PORT"
fi
NEW_WEB_PORT=$(find_free_port "$WEB_PORT")
if [ "$NEW_WEB_PORT" != "$WEB_PORT" ]; then
  echo "⚠️  Port $WEB_PORT busy — using $NEW_WEB_PORT for web app."
  WEB_PORT="$NEW_WEB_PORT"
fi

# --- sanity checks ---------------------------------------------------------
if ! command -v uv >/dev/null 2>&1; then
  echo "❌ 'uv' not found. Install: https://docs.astral.sh/uv/getting-started/installation/"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "❌ 'npm' not found. Install Node 20+: https://nodejs.org/"
  exit 1
fi
if [ ! -f web-app/.env.local ] || ! grep -q '^OPENAI_API_KEY=' web-app/.env.local; then
  echo "❌ web-app/.env.local missing or has no OPENAI_API_KEY."
  echo "   Create it with:  echo 'OPENAI_API_KEY=sk-...' > web-app/.env.local"
  exit 1
fi

# --- install web deps if needed --------------------------------------------
if [ ! -d web-app/node_modules ]; then
  echo "📦 Installing web-app dependencies..."
  (cd web-app && npm install)
fi

# --- start MCP server ------------------------------------------------------
echo "🚀 Starting MCP server on http://localhost:${MCP_PORT}"
PORT="$MCP_PORT" uv run uvicorn main:app --host 127.0.0.1 --port "$MCP_PORT" &
MCP_PID=$!

cleanup() {
  echo ""
  echo "🛑 Stopping..."
  kill "$MCP_PID" 2>/dev/null || true
  kill "$WEB_PID" 2>/dev/null || true
  wait "$MCP_PID" 2>/dev/null || true
  wait "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for MCP to be ready
for i in {1..20}; do
  if curl -fsS "http://localhost:${MCP_PORT}/healthz" >/dev/null 2>&1; then
    echo "✅ MCP server is up."
    break
  fi
  sleep 0.5
done

# --- start web app ---------------------------------------------------------
echo "🚀 Starting web app on http://localhost:${WEB_PORT}"
(cd web-app && PORT="$WEB_PORT" MCP_SERVER_URL="http://localhost:${MCP_PORT}" npm run dev) &
WEB_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📷  Web:  http://localhost:${WEB_PORT}"
echo "  🤖  MCP:  http://localhost:${MCP_PORT}  (/sse, /healthz, /image/latest)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Press Ctrl+C to stop both."

wait "$WEB_PID"
