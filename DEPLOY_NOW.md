# Deploy SocialPulse — Render + Vercel + Neon + Upstash

## Stack
| Layer | Service |
|-------|---------|
| API (Node/Express) | [Render](https://render.com) — Web Service |
| Frontend (Next.js) | [Vercel](https://vercel.com) |
| Database | [Neon](https://neon.tech) — PostgreSQL |
| Cache + Queue | [Upstash](https://upstash.com) — Redis |

---

## Step 1 — Commit and push (run in your terminal)

```bash
cd C:\Users\manis\OneDrive\Documents\SocialPulse\socialpulse

# Remove stale git lock if needed
del .git\index.lock 2>nul

git add -A

git commit -m "feat: complete SocialPulse platform build

- Full V2 platform: onboarding, summary, content studio, competitors
- Phase 6: settings pages, team invite, special days seed
- All 6 phases complete"

git push origin main
```

---

## Step 2 — Neon database setup

1. Go to [neon.tech](https://neon.tech) → your project → **Connection string**
2. Copy the pooled connection string — it looks like:
   ```
   postgresql://user:password@ep-xxx-yyy.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Run the migration **locally** with that URL set:
   ```bash
   cd C:\Users\manis\OneDrive\Documents\SocialPulse\socialpulse\apps\api
   
   # Set the URL temporarily and migrate
   set DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require
   npx prisma migrate deploy
   ```
4. Then seed special days:
   ```bash
   npx tsx src/scripts/seed-special-days.ts
   ```

---

## Step 3 — Upstash Redis setup

1. Go to [upstash.com](https://upstash.com) → **Create Database** → choose region
2. Copy the **REST URL** — but you need the **Redis connection string**, not REST.
   - In your Upstash database → **Details** tab → find **Redis URL**
   - It starts with: `rediss://default:xxxxx@global.upstash.io:6379`
3. Save this as `REDIS_URL` in Render (Step 4 below)

---

## Step 4 — Deploy API to Render

### First time setup:
1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo → select `GROOT-07/socialpulse`
3. Configure the service:

   | Field | Value |
   |-------|-------|
   | **Name** | `socialpulse-api` |
   | **Branch** | `main` |
   | **Root Directory** | *(leave blank)* |
   | **Build Command** | `pnpm install --frozen-lockfile && pnpm --filter @socialpulse/api exec prisma generate && pnpm --filter @socialpulse/api run build` |
   | **Start Command** | `node apps/api/dist/index.js` |
   | **Instance Type** | Free (or Starter $7/mo for always-on) |

4. Set **Environment Variables** in Render → Environment tab:

```
DATABASE_URL           = postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require
REDIS_URL              = rediss://default:xxxxx@global.upstash.io:6379
JWT_SECRET             = (generate: openssl rand -hex 32)
JWT_REFRESH_SECRET     = (generate: openssl rand -hex 32)
ENCRYPTION_KEY         = sp-prod-key-exactly-32chars!!
NODE_ENV               = production
PORT                   = 4000
API_BASE_URL           = https://socialpulse-api.onrender.com
CORS_ORIGINS           = https://YOUR-APP.vercel.app
ANTHROPIC_API_KEY      = sk-ant-...

# Optional V2 features (add when ready):
SERPAPI_KEY                      = (from serpapi.com — 100 free/month)
GOOGLE_KNOWLEDGE_GRAPH_API_KEY   = (Google Cloud Console)
GOOGLE_PLACES_API_KEY            = (Google Cloud Console)

# Social OAuth (add when connecting accounts):
META_APP_ID            = 
META_APP_SECRET        = 
META_REDIRECT_URI      = https://socialpulse-api.onrender.com/api/auth/instagram/callback
GOOGLE_CLIENT_ID       = 
GOOGLE_CLIENT_SECRET   = 
GOOGLE_REDIRECT_URI    = https://socialpulse-api.onrender.com/api/auth/youtube/callback
DATA365_API_KEY        = 
```

5. Click **Create Web Service** → wait for build (~3-5 min)
6. Test: visit `https://socialpulse-api.onrender.com/health` → should return `{"status":"ok"}`

### Already deployed — auto-redeploys:
- Every push to `main` triggers a Render redeploy automatically.
- Go to render.com → your service → **Deploys** tab to monitor.

---

## Step 5 — Deploy Frontend to Vercel

### First time setup:
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `GROOT-07/socialpulse` from GitHub
3. Vercel detects `vercel.json` automatically
4. Set **Environment Variables** in Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL    = https://socialpulse-api.onrender.com
NEXT_PUBLIC_APP_URL    = https://YOUR-APP.vercel.app
NEXTAUTH_SECRET        = (generate: openssl rand -hex 32)
NEXTAUTH_URL           = https://YOUR-APP.vercel.app
```

5. Click **Deploy** → wait ~2 min

### Already deployed — auto-redeploys:
- Every push to `main` triggers a Vercel redeploy automatically.

---

## Step 6 — Wire the URLs together (after both are live)

Once you have your actual Render URL and Vercel URL:

**In Render** → update:
```
API_BASE_URL  = https://socialpulse-api.onrender.com   ← your actual Render URL
CORS_ORIGINS  = https://your-app.vercel.app             ← your actual Vercel URL
```

**In Vercel** → update:
```
NEXT_PUBLIC_API_URL = https://socialpulse-api.onrender.com
NEXT_PUBLIC_APP_URL = https://your-app.vercel.app
NEXTAUTH_URL        = https://your-app.vercel.app
```

Then trigger a redeploy of both services.

---

## Generate secrets (run these locally)

```bash
# Windows PowerShell:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Run 3 times — use for JWT_SECRET, JWT_REFRESH_SECRET, NEXTAUTH_SECRET
```

For `ENCRYPTION_KEY` — must be **exactly 32 characters**:
```
sp-production-key-32chars!!!!!!
```

---

## All features live after deploy

| Feature | URL |
|---------|-----|
| Dashboard | / |
| Organization Summary | /summary |
| Daily Brief | /brief |
| Analytics (IG/FB/YT) | /analytics |
| Competitors | /competitors |
| Gap Analysis | /competitors/gap-analysis |
| Content Spy | /competitors/content |
| Goals & KPIs | /strategy/goals |
| Personas | /strategy/personas |
| Brand Voice | /strategy/voice |
| Content Pillars | /strategy/pillars |
| Post Generator | /studio/posts |
| Video Scripts | /studio/video |
| Blog Writer | /studio/blog |
| Smart Calendar | /studio/calendar |
| SEO Planner | /studio/seo |
| Trending Now | /studio/trends |
| Content Calendar | /calendar |
| Checklist | /checklist |
| Ideas Bank | /ideas |
| Profile Audit | /audit |
| Playbook | /playbook |
| Org Settings | /settings |
| Connected Accounts | /settings/accounts |
| Team Members | /settings/team |
| Admin Panel | /admin |

---

## Free tier cost estimate

| Service | Free tier | Limit |
|---------|-----------|-------|
| [Neon](https://neon.tech) | Free forever | 512MB storage |
| [Upstash](https://upstash.com) | Free forever | 10K commands/day |
| [Render](https://render.com) | Free (spins down after 15min inactivity) | Use Starter $7/mo for always-on |
| [Vercel](https://vercel.com) | Free forever | Unlimited Next.js deploys |
| [SerpAPI](https://serpapi.com) | 100 searches/month free | Upgrade when needed |

**Estimated cost: $0/month (free tier) or $7/month (Render Starter for always-on API)**

> ⚠️ **Render free tier spins down after 15 min of inactivity** — first request after idle takes ~30 seconds to wake up. Upgrade to Starter ($7/mo) to keep it always on for production use.
