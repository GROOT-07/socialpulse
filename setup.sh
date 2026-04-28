#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
# SocialPulse — Phase 1 Setup Script
# Run this once after cloning / first pull.
# Requires: Node 20+, pnpm 9+, Docker Desktop
# ────────────────────────────────────────────────────────────────
set -e

echo "▶  Checking prerequisites..."
node --version
pnpm --version

echo ""
echo "▶  Installing dependencies..."
pnpm install

echo ""
echo "▶  Copying environment files..."
[ ! -f .env ] && cp .env.example .env && echo "  Created .env — fill in your secrets before starting."

[ ! -f apps/api/.env ] && cat > apps/api/.env << 'ENVEOF'
DATABASE_URL=postgresql://postgres:password@localhost:5432/socialpulse
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret-change-in-production-min32
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production-min32
ENCRYPTION_KEY=dev-encryption-key-32-chars-here!
NODE_ENV=development
PORT=4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENVEOF
echo "  Created apps/api/.env"

[ ! -f apps/web/.env.local ] && cat > apps/web/.env.local << 'ENVEOF'
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
ENVEOF
echo "  Created apps/web/.env.local"

echo ""
echo "▶  Starting Docker services (Postgres + Redis)..."
docker compose up -d

echo ""
echo "▶  Waiting for Postgres to be ready..."
until docker exec socialpulse_db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "  Postgres is ready."

echo ""
echo "▶  Generating Prisma client..."
pnpm --filter @socialpulse/api db:generate

echo ""
echo "▶  Running database migrations..."
pnpm --filter @socialpulse/api db:push

echo ""
echo "────────────────────────────────────────────────────────────────"
echo "✅  Setup complete!"
echo ""
echo "To start the development servers, open two terminals:"
echo ""
echo "  Terminal 1 — API:  pnpm --filter @socialpulse/api dev"
echo "  Terminal 2 — Web:  pnpm --filter @socialpulse/web dev"
echo ""
echo "  Web:  http://localhost:3000"
echo "  API:  http://localhost:4000"
echo "  API health check: http://localhost:4000/health"
echo "────────────────────────────────────────────────────────────────"
