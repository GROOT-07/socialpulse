import { Worker } from 'bullmq'
import { redisWorker } from '../lib/redis'
import type { DailyBriefJobData } from '../lib/queue'
import { prisma } from '../lib/prisma'

export function createBriefWorker(): Worker<DailyBriefJobData> {
  const worker = new Worker<DailyBriefJobData>(
    'daily-brief',
    async (job) => {
      const { orgId } = job.data
      const { generateDailyBrief } = await import('../services/ai/aiService')
      if (orgId === 'ALL') {
        const orgs = await prisma.organization.findMany({ select: { id: true } })
        await Promise.allSettled(orgs.map((o) => generateDailyBrief(o.id)))
      } else {
        await generateDailyBrief(orgId)
      }
    },
    { connection: redisWorker, concurrency: 2 },
  )

  worker.on('completed', (job) => console.info(`[brief-worker] ✅ ${job.id}`))
  worker.on('failed', (job, err) => console.error(`[brief-worker] ❌ ${job?.id}:`, err.message))
  worker.on('error', (err) => console.error('[brief-worker]', err))

  return worker
}
