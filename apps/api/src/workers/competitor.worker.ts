import { Worker } from 'bullmq'
import { redisWorker } from '../lib/redis'
import type { CompetitorSyncJobData } from '../lib/queue'
import { syncCompetitor, syncAllCompetitors } from '../services/competitor/competitorSyncService'

export function createCompetitorWorker(): Worker<CompetitorSyncJobData> {
  const worker = new Worker<CompetitorSyncJobData>(
    'competitor-sync',
    async (job) => {
      const { competitorId } = job.data
      if (competitorId === 'ALL') {
        await syncAllCompetitors()
      } else {
        await syncCompetitor(competitorId)
      }
    },
    { connection: redisWorker, concurrency: 3 },
  )

  worker.on('completed', (job) => console.info(`[competitor-worker] ✅ ${job.id}`))
  worker.on('failed', (job, err) => console.error(`[competitor-worker] ❌ ${job?.id}:`, err.message))
  worker.on('error', (err) => console.error('[competitor-worker]', err))

  return worker
}
