#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r backend/requirements.txt

if [[ ! -d frontend/node_modules ]]; then
  (cd frontend && npm install)
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — add OPENAI_API_KEY before extraction will work."
fi

echo "API  http://127.0.0.1:8000"
echo "App  http://localhost:5173"
echo

(cd backend && PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8000) &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT

cd frontend
npm run dev
