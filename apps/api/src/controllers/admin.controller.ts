import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { metricsQueue, competitorSyncQueue, tokenRefreshQueue, dailyBriefQueue } from '../lib/queue'

export async function listOrgs(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'SUPER_ADMIN') { res.status(403).json({ error: 'Forbidden' }); return }
  const orgs = await prisma.organization.findMany({
    include: { _count: { select: { members: true, socialAccounts: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ data: { orgs } })
}

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'SUPER_ADMIN') { res.status(403).json({ error: 'Forbidden' }); return }
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true, activeOrgId: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ data: { users } })
}

export async function getJobQueues(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'SUPER_ADMIN') { res.status(403).json({ error: 'Forbidden' }); return }

  const [mWaiting, mFailed, cWaiting, cFailed, tFailed, bFailed] = await Promise.all([
    metricsQueue.getWaitingCount(),
    metricsQueue.getFailedCount(),
    competitorSyncQueue.getWaitingCount(),
    competitorSyncQueue.getFailedCount(),
    tokenRefreshQueue.getFailedCount(),
    dailyBriefQueue.getFailedCount(),
  ])

  res.json({
    data: {
      queues: [
        { name: 'metrics-sync',    waiting: mWaiting, active: 0, completed: 0, failed: mFailed },
        { name: 'competitor-sync', waiting: cWaiting, active: 0, completed: 0, failed: cFailed },
        { name: 'token-refresh',   waiting: 0,        active: 0, completed: 0, failed: tFailed },
        { name: 'daily-brief',     waiting: 0,        active: 0, completed: 0, failed: bFailed },
      ],
    },
  })
}

export async function getApiHealth(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'SUPER_ADMIN') { res.status(403).json({ error: 'Forbidden' }); return }
  const env = process.env
  const checks = {
    meta:      !!env['META_APP_ID'],
    youtube:   !!env['GOOGLE_CLIENT_ID'],
    data365:   !!env['DATA365_API_KEY'],
    anthropic: !!env['ANTHROPIC_API_KEY'],
  }
  res.json({ data: { apiHealth: checks } })
}

export async function resetOrgData(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'SUPER_ADMIN') { res.status(403).json({ error: 'Forbidden' }); return }
  const { orgId, type } = req.body as { orgId: string; type: 'checklist' | 'audit' | 'metrics' }

  if (type === 'checklist') {
    await prisma.checklistItem.updateMany({ where: { orgId }, data: { isDone: false, doneAt: null } })
  } else if (type === 'audit') {
    await prisma.auditItem.updateMany({ where: { orgId }, data: { isDone: false, score: 0 } })
  } else if (type === 'metrics') {
    await prisma.socialMetrics.deleteMany({ where: { socialAccount: { orgId } } })
  }

  res.json({ data: { reset: true } })
}
