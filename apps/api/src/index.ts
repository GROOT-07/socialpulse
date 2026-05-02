import 'dotenv/config'
import { validateEnv, startWorkersSafely } from './lib/startup'

// ── Validate env before anything else touches process.env ─────
validateEnv()

// ── Prevent Redis/BullMQ connection errors from crashing the process ──
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  console.error('[unhandledRejection] Caught — process will continue:', msg)
})

import express, { type Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'

import authRoutes from './routes/auth.routes'
import orgRoutes from './routes/org.routes'
import socialRoutes from './routes/social.routes'
import metricsRoutes from './routes/metrics.routes'
import competitorRoutes from './routes/competitor.routes'
import aiRoutes from './routes/ai.routes'
import strategyRoutes from './routes/strategy.routes'
import calendarRoutes from './routes/calendar.routes'
import checklistRoutes from './routes/checklist.routes'
import ideasRoutes from './routes/ideas.routes'
import auditRoutes from './routes/audit.routes'
import briefRoutes from './routes/brief.routes'
import settingsRoutes from './routes/settings.routes'
import adminRoutes from './routes/admin.routes'
import { progressRouter } from './routes/progress.routes'
import specialDaysRoutes from './routes/specialdays.routes'
import trendsRoutes from './routes/trends.routes'
import opsRoutes from './routes/ops.routes'
import reputationRoutes from './routes/reputation.routes'
import teamRoutes from './routes/team.routes'
import { errorHandler } from './middleware/errorHandler'
import { scheduleRecurringJobs } from './lib/queue'
import { createMetricsWorker } from './workers/metrics.worker'
import { createTokenRefreshWorker } from './workers/tokenRefresh.worker'
import { createCompetitorWorker } from './workers/competitor.worker'
import { createBriefWorker } from './workers/brief.worker'
import './workers/onboarding.worker' // Auto-registers all 6 onboarding workers

const app: Application = express()
const PORT = Number(process.env.PORT ?? 4000)

// ── Security & parsing ────────────────────────────────────────
app.use(helmet())

// Build allowed origin list from comma-separated CORS_ORIGINS env var.
// Supports exact origins and wildcard patterns (e.g. https://*.vercel.app).
const rawOrigins = process.env.CORS_ORIGINS ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const normalise = (o: string) => o.trim().replace(/\/+$/, '')

const { exactOrigins, wildcardPatterns } = rawOrigins
  .split(',')
  .map(normalise)
  .filter(Boolean)
  .reduce<{ exactOrigins: Set<string>; wildcardPatterns: RegExp[] }>(
    (acc, o) => {
      if (o.includes('*')) {
        // Convert glob-style wildcard to regex: * → match any non-slash chars
        const pattern = new RegExp('^' + o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+') + '$')
        acc.wildcardPatterns.push(pattern)
      } else {
        acc.exactOrigins.add(o)
      }
      return acc
    },
    { exactOrigins: new Set(), wildcardPatterns: [] },
  )

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) return callback(null, true)
      const normOrigin = normalise(origin)
      if (exactOrigins.has(normOrigin)) return callback(null, true)
      if (wildcardPatterns.some((p) => p.test(normOrigin))) return callback(null, true)
      console.warn(`[CORS] Blocked origin: ${origin}`)
      callback(new Error(`CORS: origin '${origin}' not allowed`))
    },
    credentials: true,
  }),
)
app.use(compression())
app.use(express.json({ limit: '2mb' }))

// ── Rate limiting ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests', message: 'Please wait before trying again' },
})

app.use(globalLimiter)

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/orgs', orgRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/metrics', metricsRoutes)
app.use('/api/competitors', competitorRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/strategy', strategyRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/checklist', checklistRoutes)
app.use('/api/ideas', ideasRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/brief', briefRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/progress', progressRouter)
app.use('/api/special-days', specialDaysRoutes)
app.use('/api/trends', trendsRoutes)
app.use('/api/ops', opsRoutes)
app.use('/api/reputation', reputationRoutes)
app.use('/api/team', teamRoutes)

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', message: 'This route does not exist' })
})

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.info(`🚀 SocialPulse API running on http://localhost:${PORT}`)

  // Start BullMQ workers — wrapped so a Redis outage doesn't crash the process
  await startWorkersSafely([
    { name: 'Metrics worker',        start: createMetricsWorker },
    { name: 'Token refresh worker',  start: createTokenRefreshWorker },
    { name: 'Competitor worker',     start: createCompetitorWorker },
    { name: 'Daily brief worker',