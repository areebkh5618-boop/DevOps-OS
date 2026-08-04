#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/backend"
if [ ! -d venv ]; then
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
else
  source venv/bin/activate
fi
[ -f .env ] || cp .env.example .env
echo "Starting DevVerse API on http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
