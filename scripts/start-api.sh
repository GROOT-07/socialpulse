#!/bin/sh
# ─────────────────────────────────────────────────────────────
# SocialPulse API — production start script
# Runs Prisma migrations then starts the Node server.
# ─────────────────────────────────────────────────────────────
set -e

echo "[start] Running database migrations..."
cd /app/apps/api
npx prisma migrate deploy

echo "[start] Migrations complete. Starting API server..."
cd /app
exec node apps/api/dist/index.js
