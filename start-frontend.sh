#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/frontend"
[ -d node_modules ] || npm install
echo "Starting DevVerse UI on http://localhost:3000"
npm run dev
