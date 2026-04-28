# ─────────────────────────────────────────────────────────────
# SocialPulse API — Multi-stage Dockerfile
# Build context: monorepo root
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Base image with pnpm ─────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# ── Stage 2: Install all dependencies ─────────────────────────
FROM base AS deps
WORKDIR /app

# Copy workspace manifests only (for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Install prod + dev deps (need devDeps to build TypeScript)
RUN pnpm install --frozen-lockfile

# ── Stage 3: Build TypeScript ──────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

# Generate Prisma client, then compile TS → JS
RUN pnpm --filter @socialpulse/api exec prisma generate
RUN pnpm --filter @socialpulse/api run build

# ── Stage 4: Production image (lean) ──────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only copy what runtime needs
COPY --from=builder /app/apps/api/dist         ./apps/api/dist
COPY --from=builder /app/apps/api/prisma       ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json          ./package.json

# Copy Prisma-generated client (lives in node_modules)
COPY --from=builder /app/node_modules/.pnpm              ./node_modules/.pnpm
COPY --from=builder /app/node_modules/.modules.yaml      ./node_modules/.modules.yaml
COPY --from=builder /app/apps/api/node_modules           ./apps/api/node_modules

# Startup script (migrate then serve)
COPY scripts/start-api.sh ./scripts/start-api.sh
RUN chmod +x ./scripts/start-api.sh

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["./scripts/start-api.sh"]
