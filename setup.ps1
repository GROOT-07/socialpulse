# ────────────────────────────────────────────────────────────────
# SocialPulse — Phase 1 Setup Script (Windows PowerShell)
# Uses Neon (Postgres) + Upstash (Redis) — no Docker needed
# Run: .\setup.ps1
# Requires: Node 20+, pnpm
# ────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  SocialPulse — Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ── Prerequisites ───────────────────────────────────────────────
Write-Host "▶  Checking prerequisites..." -ForegroundColor Cyan
$nodeVersion = node --version
$pnpmVersion = pnpm --version
Write-Host "  Node:  $nodeVersion" -ForegroundColor Green
Write-Host "  pnpm:  $pnpmVersion" -ForegroundColor Green

# ── Install deps ────────────────────────────────────────────────
Write-Host ""
Write-Host "▶  Installing dependencies..." -ForegroundColor Cyan
pnpm install

# ── Collect secrets interactively ───────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  You need two free cloud services:" -ForegroundColor Yellow
Write-Host "  1. Neon   (Postgres) → https://neon.tech" -ForegroundColor White
Write-Host "  2. Upstash (Redis)   → https://upstash.com" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

$DATABASE_URL = Read-Host "  Paste your Neon DATABASE_URL"
$REDIS_URL    = Read-Host "  Paste your Upstash REDIS_URL"

# ── Write apps/api/.env ─────────────────────────────────────────
Write-Host ""
Write-Host "▶  Writing apps\api\.env..." -ForegroundColor Cyan

$apiEnv = @"
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL
JWT_SECRET=sp-jwt-$(New-Guid)-secret
JWT_REFRESH_SECRET=sp-refresh-$(New-Guid)-secret
ENCRYPTION_KEY=sp-enc-key-32chars-$(Get-Random -Maximum 9999)!!
NODE_ENV=development
PORT=4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
"@

$apiEnv | Out-File -FilePath "apps\api\.env" -Encoding utf8
Write-Host "  Created apps\api\.env" -ForegroundColor Green

# ── Write apps/web/.env.local ───────────────────────────────────
Write-Host "▶  Writing apps\web\.env.local..." -ForegroundColor Cyan

$webEnv = @"
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=sp-nextauth-$(New-Guid)
NEXTAUTH_URL=http://localhost:3000
"@

$webEnv | Out-File -FilePath "apps\web\.env.local" -Encoding utf8
Write-Host "  Created apps\web\.env.local" -ForegroundColor Green

# ── Prisma generate + push ──────────────────────────────────────
Write-Host ""
Write-Host "▶  Generating Prisma client..." -ForegroundColor Cyan
pnpm --filter @socialpulse/api run db:generate

Write-Host ""
Write-Host "▶  Pushing schema to Neon database..." -ForegroundColor Cyan
pnpm --filter @socialpulse/api run db:push

# ── Done ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  ✅  Setup complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "  Open TWO PowerShell windows and run:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Window 1 (API):  pnpm --filter @socialpulse/api run dev" -ForegroundColor White
Write-Host "  Window 2 (Web):  pnpm --filter @socialpulse/web run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Web  →  http://localhost:3000" -ForegroundColor White
Write-Host "  API  →  http://localhost:4000/health" -ForegroundColor White
Write-Host ""
