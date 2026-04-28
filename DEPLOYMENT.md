# SocialPulse — Deployment Guide

> **Stack**: Railway (API) + Vercel (Web) + Neon (PostgreSQL) + Upstash (Redis)  
> **Time to complete**: ~30 minutes if you have all credentials ready

---

## Prerequisites — what you need before starting

| Item | Where to get it |
|------|----------------|
| Railway account | railway.app → Sign up free |
| Vercel account | vercel.com → Sign up free |
| Neon account + project | neon.tech → Already set up (use existing DATABASE_URL) |
| Upstash Redis | upstash.com → Already set up (use existing REDIS_URL) |
| Anthropic API key | console.anthropic.com |
| Meta App (for Instagram/Facebook) | developers.facebook.com |
| Google Cloud project (for YouTube) | console.cloud.google.com |

---

## Step 1 — Push code to GitHub

```bash
# From the monorepo root
git add -A
git commit -m "chore: production-ready build"
git push origin main
```

---

## Step 2 — Deploy the API to Railway

### 2a. Create a new Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo**
3. Pick your `socialpulse` repository
4. Railway detects `nixpacks.toml` and uses it automatically

### 2b. Set environment variables

In the Railway dashboard → your service → **Variables** tab, add **all** of these:

```
# ── Required ──────────────────────────────────────────────
DATABASE_URL          = (your Neon connection string — use the pooled URL)
REDIS_URL             = (your Upstash Redis URL — starts with rediss://)
JWT_SECRET            = (generate: openssl rand -hex 32)
JWT_REFRESH_SECRET    = (generate: openssl rand -hex 32)
ENCRYPTION_KEY        = (exactly 32 characters, e.g.: sp-enc-key-32chars-padded!!)
NODE_ENV              = production

# ── API URLs (fill in after Railway gives you a domain) ──
API_BASE_URL          = https://your-api.railway.app
CORS_ORIGINS          = https://your-web.vercel.app
NEXT_PUBLIC_APP_URL   = https://your-web.vercel.app

# ── Social APIs ────────────────────────────────────────────
META_APP_ID           = (from Meta Developer Console)
META_APP_SECRET       = (from Meta Developer Console)
GOOGLE_CLIENT_ID      = (from Google Cloud Console)
GOOGLE_CLIENT_SECRET  = (from Google Cloud Console)

# ── AI ─────────────────────────────────────────────────────
ANTHROPIC_API_KEY     = sk-ant-...

# ── Competitor data (optional) ─────────────────────────────
DATA365_API_KEY       = (from data365.co — leave blank to disable)
```

> **PORT is injected by Railway automatically** — do not set it manually.

### 2c. Trigger first deploy

Railway auto-deploys on every push. To trigger manually:

```bash
# Install Railway CLI (optional but useful)
npm install -g @railway/cli
railway login
railway up
```

### 2d. Verify the API is live

```bash
curl https://your-api.railway.app/health
# Expected: {"status":"ok","timestamp":"..."}
```

Check Railway logs for startup messages:
- `✅ Metrics worker started`
- `✅ Recurring jobs scheduled`
- Any `⚠` warnings are for missing optional keys — non-fatal

---

## Step 3 — Deploy the Web app to Vercel

### 3a. Import the project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub `socialpulse` repo
3. Vercel detects `vercel.json` → sets **Root Directory** to `apps/web` automatically
4. Framework: **Next.js** (auto-detected)

### 3b. Set environment variables in Vercel

In Vercel → Project → **Settings → Environment Variables**:

```
NEXT_PUBLIC_API_URL   = https://your-api.railway.app
NEXT_PUBLIC_APP_URL   = https://your-web.vercel.app
NEXTAUTH_SECRET       = (generate: openssl rand -hex 32)
NEXTAUTH_URL          = https://your-web.vercel.app
```

> Set all four for **Production**, **Preview**, and **Development** environments.

### 3c. Deploy

Click **Deploy** in the Vercel dashboard, or push to `main`:

```bash
git push origin main  # triggers both Railway + Vercel deploys
```

### 3d. Verify the web app

Open your Vercel URL. You should see the login page.

---

## Step 4 — Wire up OAuth redirect URIs

After both services are live, you need to register your production URLs in the social API consoles.

### Meta (Instagram + Facebook)

1. Go to [developers.facebook.com](https://developers.facebook.com) → your app
2. **Facebook Login → Settings → Valid OAuth Redirect URIs**, add:
   ```
   https://your-api.railway.app/api/social/auth/instagram/callback
   https://your-api.railway.app/api/social/auth/facebook/callback
   ```
3. Under **App Domains**, add: `your-api.railway.app`
4. Set **App Mode** to **Live** (requires app review for production use)

### Google (YouTube)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client → **Authorized redirect URIs**, add:
   ```
   https://your-api.railway.app/api/social/auth/youtube/callback
   ```
3. Add to **Authorized JavaScript origins**:
   ```
   https://your-web.vercel.app
   ```

---

## Step 5 — Update CORS after you have final URLs

Once both services are deployed and you have their real URLs, update Railway:

```
CORS_ORIGINS = https://your-web.vercel.app
```

If you later add a custom domain:
```
CORS_ORIGINS = https://app.yourdomain.com,https://your-web.vercel.app
```

---

## Step 6 — Smoke test checklist

Run through these after deployment to confirm everything is wired:

- [ ] `GET /health` on the API returns `{"status":"ok"}`
- [ ] Web app loads at the Vercel URL
- [ ] Register a new account — check Railway logs for no DB errors
- [ ] Log in — JWT token set in sessionStorage
- [ ] Create an organization — org appears in the dashboard
- [ ] Connect an Instagram account (OAuth flow completes, redirect back)
- [ ] Trigger a metrics sync — check Railway logs for worker activity
- [ ] Generate a Daily Brief (requires ANTHROPIC_API_KEY)
- [ ] Add a competitor — check Data365 sync in logs
- [ ] Generate a Playbook section (requires ANTHROPIC_API_KEY)

---

## Monitoring

### Railway logs

```bash
railway logs --tail
```

Or in the dashboard → your service → **Logs** tab.

### Key log patterns to watch

| Log message | Meaning |
|-------------|---------|
| `⚠ META_APP_ID not set` | Instagram/Facebook OAuth won't work |
| `✅ Metrics worker started` | BullMQ connected to Redis OK |
| `❌ Could not schedule recurring jobs` | Redis connection failed |
| `[ERROR] PrismaClientKnownRequestError` | DB query issue — check Railway logs |

---

## Database migrations (future schema changes)

When you update `prisma/schema.prisma`:

```bash
# Create a new migration locally
cd apps/api
pnpm exec prisma migrate dev --name your-migration-name

# Commit the migration file
git add prisma/migrations
git commit -m "db: add your-migration-name migration"
git push origin main
```

Railway will automatically run `prisma migrate deploy` as part of the start command on next deploy.

---

## Local development (recap)

```bash
# Start PostgreSQL + Redis locally
docker-compose up -d

# Install deps
pnpm install

# Push schema (first time only)
pnpm --filter @socialpulse/api run db:push

# Start both servers
pnpm run dev:api    # http://localhost:4000
pnpm run dev:web    # http://localhost:3000
```

---

## Environment variable quick reference

### Railway (API)

| Variable | Required | Default |
|----------|----------|---------|
| `DATABASE_URL` | ✅ Yes | — |
| `REDIS_URL` | ✅ Yes | — |
| `JWT_SECRET` | ✅ Yes | — |
| `JWT_REFRESH_SECRET` | ✅ Yes | — |
| `ENCRYPTION_KEY` | ✅ Yes (32 chars) | — |
| `NODE_ENV` | ✅ Yes | `production` |
| `PORT` | Auto-injected | `4000` |
| `API_BASE_URL` | ✅ Yes | — |
| `CORS_ORIGINS` | ✅ Yes | — |
| `NEXT_PUBLIC_APP_URL` | ✅ Yes | — |
| `META_APP_ID` | ⚠ Optional | — |
| `META_APP_SECRET` | ⚠ Optional | — |
| `GOOGLE_CLIENT_ID` | ⚠ Optional | — |
| `GOOGLE_CLIENT_SECRET` | ⚠ Optional | — |
| `ANTHROPIC_API_KEY` | ⚠ Optional | — |
| `DATA365_API_KEY` | ⚠ Optional | — |

### Vercel (Web)

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_API_URL` | ✅ Yes |
| `NEXT_PUBLIC_APP_URL` | ✅ Yes |
| `NEXTAUTH_SECRET` | ✅ Yes |
| `NEXTAUTH_URL` | ✅ Yes |
