# Deploy SocialPulse V2 — Run These Commands

## Step 1 — Commit all V2 changes (run in your terminal from the socialpulse/ folder)

```bash
cd C:\Users\manis\OneDrive\Documents\SocialPulse\socialpulse

git add -A

git commit -m "feat: MODIFICATIONS_V2 — full platform upgrade

- New /summary Organization Summary page (6 sections + Presence Score gauge)
- 4-step intelligent onboarding with auto-research and competitor discovery
- Content Studio: /studio/posts /studio/video /studio/blog /studio/calendar /studio/seo /studio/trends
- CompetitorDiscoveryService: auto-discovers competitors via Google Local/Maps/SEO/Claude AI
- SEOIntelligenceService: keyword discovery, rank tracking, presence score
- 6 new BullMQ onboarding jobs with SSE real-time progress
- AI calls 7-13: post gen, video scripts, blog writer, calendar, SEO brief, trending
- New Prisma models: KeywordOpportunity, ContentPiece, OrgIntelligence, SpecialDay, TrendingTopic, CompetitorPost
- New API integrations: SerpAPI, Google Knowledge Graph, Google Places
- Updated sidebar with full MODIFICATIONS_V2 structure"

git push origin main
```

---

## Step 2 — Run the database migration (REQUIRED before starting the API)

On your local machine or via Railway's shell:

```bash
cd apps/api
npx prisma migrate deploy
# OR if using pnpm:
pnpm exec prisma migrate deploy
```

The migration file is at:
`apps/api/prisma/migrations/20260429000000_v2_modifications/migration.sql`

---

## Step 3 — Deploy API to Railway

### If Railway is already connected to your GitHub repo:
- The push in Step 1 triggers an automatic redeploy.
- Go to [railway.app](https://railway.app) → your project → watch the deploy logs.

### If setting up Railway for the first time:
1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your `socialpulse` repository
3. Railway auto-detects `railway.toml` and `nixpacks.toml`
4. Set these environment variables in Railway dashboard → Variables:

```
DATABASE_URL          = (your Neon PostgreSQL URL)
REDIS_URL             = (your Upstash Redis URL — starts with rediss://)
JWT_SECRET            = (run: openssl rand -hex 32)
JWT_REFRESH_SECRET    = (run: openssl rand -hex 32)
ENCRYPTION_KEY        = (exactly 32 chars, e.g. sp-production-key-32chars!!)
NODE_ENV              = production
PORT                  = 4000
API_BASE_URL          = https://YOUR-API.railway.app
CORS_ORIGINS          = https://YOUR-APP.vercel.app
NEXT_PUBLIC_APP_URL   = https://YOUR-APP.vercel.app
ANTHROPIC_API_KEY     = sk-ant-...

# V2 additions (optional but recommended):
SERPAPI_KEY                      = (from serpapi.com)
GOOGLE_KNOWLEDGE_GRAPH_API_KEY   = (from Google Cloud Console)
GOOGLE_PLACES_API_KEY            = (from Google Cloud Console)

# Social APIs (existing):
META_APP_ID           = 
META_APP_SECRET       = 
GOOGLE_CLIENT_ID      = 
GOOGLE_CLIENT_SECRET  = 
DATA365_API_KEY       = 
```

---

## Step 4 — Deploy Web to Vercel

### If Vercel is already connected to your GitHub repo:
- The push in Step 1 triggers an automatic redeploy.
- Go to [vercel.com](https://vercel.com) → your project → watch build logs.

### If setting up Vercel for the first time:
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your `socialpulse` GitHub repo
3. Vercel detects `vercel.json` automatically — no config needed
4. Set these environment variables in Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL   = https://YOUR-API.railway.app
NEXT_PUBLIC_APP_URL   = https://YOUR-APP.vercel.app
NEXTAUTH_SECRET       = (run: openssl rand -hex 32)
NEXTAUTH_URL          = https://YOUR-APP.vercel.app
```

5. Click **Deploy**

---

## Step 5 — After deploy: run the special days seed

```bash
# On Railway shell or locally with DATABASE_URL set:
cd apps/api
npx tsx src/scripts/seed-special-days.ts
```

---

## V2 Features now live after deploy:

| Feature | URL |
|---------|-----|
| Organization Summary | /summary |
| Post Generator | /studio/posts |
| Video Scripts | /studio/video |
| Blog Writer | /studio/blog |
| Smart Calendar | /studio/calendar |
| SEO Planner | /studio/seo |
| Trending Now | /studio/trends |
| Competitor Discovery | Auto on org creation |
| Real-time job progress | /api/progress/:orgId (SSE) |
| Team Members & Invite | /settings/team |
| Org Settings (brand color, industry, timezone) | /settings |

---

## Free tier services that work for launch:

| Service | Free tier |
|---------|-----------|
| [Neon](https://neon.tech) | 512MB PostgreSQL — sufficient for early users |
| [Upstash](https://upstash.com) | 10K commands/day Redis — sufficient for BullMQ |
| [Railway](https://railway.app) | $5 free credit/month — runs the API |
| [Vercel](https://vercel.com) | Unlimited free for Next.js frontend |
| [SerpAPI](https://serpapi.com) | 100 searches/month free |

**Estimated cost at launch: $0–5/month**
