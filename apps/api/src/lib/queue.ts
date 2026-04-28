import { Queue } from 'bullmq'
import { redis } from './redis'

// ── Queue definitions ─────────────────────────────────────────
export const metricsQueue = new Queue('metrics-sync', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
})

export const tokenRefreshQueue = new Queue('token-refresh', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
})

export const dailyBriefQueue = new Queue('daily-brief', {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
})

export const competitorSyncQueue = new Queue('competitor-sync', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
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
