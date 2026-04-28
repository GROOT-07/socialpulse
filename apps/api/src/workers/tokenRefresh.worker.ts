/**
 * BullMQ worker — processes token-refresh jobs.
 * Finds expiring YouTube OAuth tokens and refreshes them proactively.
 */

import { Worker } from 'bullmq'
import { redisWorker } from '../lib/redis'
import type { TokenRefreshJobData } from '../lib/queue'
import { refreshExpiringTokens } from '../services/social/socialDataService'

export function createTokenRefreshWorker(): Worker<TokenRefreshJobData> {
  const worker = new Worker<TokenRefreshJobData>(
    'token-refresh',
    async (job) => {
      const { socialAccountId } = job.data
      console.info(`[token-refresh-worker] Processing job ${job.id} — account: ${socialAccountId}`)
      await refreshExpiringTokens(socialAccountId === 'ALL' ? undefined : socialAccountId)
      console.info(`[token-refresh-worker] Completed job ${job.id}`)
    },
    { connection: redisWorker, concurrency: 3 },
  )

  worker.on('completed', (job) => console.info(`[token-refresh-worker] ✅ Job ${job.id} completed`))
  worker.on('failed', (job, err) => console.error(`[token-refresh-worker] ❌ Job ${job?.id} failed:`, err.message))
  worker.on('error', (err) => console.error('[token-refresh-worker] Worker error:', err))

  return worker
}
