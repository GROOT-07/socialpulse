import { Queue } from 'bullmq'
import { redis } from './redis'

function makeQueue(name: string, defaultJobOptions: ConstructorParameters<typeof Queue>[1]['defaultJobOptions']): Queue {
  const q = new Queue(name, { connection: redis, defaultJobOptions })
  // Prevent unhandled 'error' events from crashing the process.
  // Workers handle connection errors individually via their own error listeners.
  q.on('error', (err) => {
    console.error(`[queue:${name}] error:`, err.message)
  })
  return q
}

// ── Queue definitions ─────────────────────────────────────────
export const metricsQueue = makeQueue('metrics-sync', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
})

export const tokenRefreshQueue = makeQueue('token-refresh', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
})

export const dailyBriefQueue = makeQueue('daily-brief', {
  attempts: 2,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
})

export const competitorSyncQueue = makeQueue('competitor-sync', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
})

// ── Job type definitions ──────────────────────────────────────
export interface SyncMetricsJobData {
  orgId: string
  platform?: 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'
}

export interface TokenRefreshJobData {
  socialAccountId: string
}

export interface DailyBriefJobData {
  orgId: string
}

export interface CompetitorSyncJobData {
  competitorId: string
}

// ── Schedule recurring jobs ───────────────────────────────────
export async function scheduleRecurringJobs(): Promise<void> {
  await metricsQueue.upsertJobScheduler(
    'daily-metrics-sync',
    { pattern: '0 7 * * *' },
    { name: 'sync-all-orgs', data: { orgId: 'ALL' } as SyncMetricsJobData },
  )

  await tokenRefreshQueue.upsertJobScheduler(
    'token-refresh-check',
    { pattern: '0 */6 * * *' },
    { name: 'refresh-expiring-tokens', data: { socialAccountId: 'ALL' } as TokenRefreshJobData },
  )

  await competitorSyncQueue.upsertJobScheduler(
    'daily-competitor-sync',
    { pattern: '0 8 * * *' },
    { name: 'sync-all-competitors', data: { competitorId: 'ALL' } as CompetitorSyncJobData },
  )

  await dailyBriefQueue.upsertJobScheduler(
    'daily-brief-generation',
    { pattern: '30 7 * * *' },
    { name: 'generate-all-briefs', data: { orgId: 'ALL' } as DailyBriefJobData },
  )

  console.info('✅ Recurring jobs scheduled')
}
