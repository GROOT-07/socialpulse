/**
 * BullMQ worker — processes metrics-sync jobs.
 * Reads from metricsQueue, calls socialDataService, writes snapshots to DB.
 */

import { Worker } from 'bullmq'
import { redisWorker } from '../lib/redis'
import type { SyncMetricsJobData } from '../lib/queue'
import { syncOrgAccounts, syncAllOrgs } from '../services/social/socialDataService'

export function createMetricsWorker(): Worker<SyncMetricsJobData> {
  const worker = new Worker<SyncMetricsJobData>(
    'metrics-sync',
    async (job) => {
      const { orgId } = job.data
      console.info(`[metrics-worker] Processing job ${job.id} — orgId: ${orgId}`)
      if (orgId === 'ALL') {
        await syncAllOrgs()
      } else {
        await syncOrgAccounts(orgId)
      }
      console.info(`[metrics-worker] Completed job ${job.id}`)
    },
    { connection: redisWorker, concurrency: 2 },
  )

  worker.on('completed', (job) => console.info(`[metrics-worker] ✅ Job ${job.id} completed`))
  worker.on('failed', (job, err) => console.error(`[metrics-worker] ❌ Job ${job?.id} failed:`, err.message))
  worker.on('error', (err) => console.error('[metrics-worker] Worker error:', err))

  return worker
}
