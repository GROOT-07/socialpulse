import { Queue, type DefaultJobOptions } from 'bullmq'
import { redis } from './redis'

function makeQueue(name: string, defaultJobOptions: DefaultJobOptions): Queue {
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

// ── V2 Onboarding Intelligence Queues ────────────────────────
export const orgIntelligenceQueue = makeQueue('org-intelligence', {
  attempts: 2,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
})

export const socialProfileScanQueue = makeQueue('social-profile-scan', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 3000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
})

export const competitorDiscoveryQueue = makeQueue('competitor-discovery', {
  attempts: 2,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
})

export const seoKeywordDiscoveryQueue = makeQueue('seo-keyword-discovery', {
  attempts: 2,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
})

export const contentStrategyQueue = makeQueue('content-strategy-generation', {
  attempts: 2,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
})

export const orgSummaryQueue = makeQueue('org-summary-generation', {
  attempts: 2,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
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

// V2 job data types
export interface OrgIntelligenceJobData {
  orgId: string
}

export interface SocialProfileScanJobData {
  orgId: string
  platform: string
  profileUrl: string
}

export interface CompetitorDiscoveryJobData {
  orgId: string
}

export interface SEOKeywordDiscoveryJobData {
  orgId: string
}

export interface ContentStrategyJobData {
  orgId: string
}

export interface OrgSummaryJobData {
  orgId: string
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

  // V2 — weekly competitor re-discovery
  await competitorDiscoveryQueue.upsertJobScheduler(
    'weekly-competitor-rediscovery',
    { pattern: '0 9 * * 1' }, // Every Monday at 9 AM
    { name: 'rediscover-all-orgs', data: { orgId: 'ALL' } as CompetitorDiscoveryJobData },
  )

  // V2 — weekly SEO rank refresh
  await seoKeywordDiscoveryQueue.upsertJobScheduler(
    'weekly-seo-rank-refresh',
    { pattern: '0 10 * * 1' }, // Every Monday at 10 AM
    { name: 'refresh-all-ranks', data: { orgId: 'ALL' } as SEOKeywordDiscoveryJobData },
  )

  console.info('✅ Recurring jobs scheduled (v2 included)')
}
