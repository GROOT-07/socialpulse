import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { dailyBriefQueue } from '../lib/queue'

function org(req: AuthRequest): string { return (req.headers['x-org-id'] as string) || '' }

// Maps DB DailyBrief row → frontend-expected shape
function mapBrief(row: {
  id: string
  orgId: string
  date: Date
  summary: string
  pendingTasks: unknown
  scheduledPosts: unknown
  ideaOfDay: string | null
  competitorPulse: unknown
  generatedAt: Date
}) {
  // pendingTasks is array of ChecklistItem objects → extract titles as action items
  const pendingTasks = Array.isArray(row.pendingTasks) ? row.pendingTasks as Array<{ title?: string }> : []
  const actionItems: string[] = pendingTasks.map((t) => t.title ?? '').filter(Boolean)

  // competitorPulse is array of { handle, followersDelta } objects → build alert string
  const competitors = Array.isArray(row.competitorPulse) ? row.competitorPulse as Array<{ handle?: string; followersDelta?: number }> : []
  const competitorAlert = competitors.length > 0
    ? competitors.map((c) => `${c.handle ?? 'Competitor'} ${(c.followersDelta ?? 0) >= 0 ? 'gained' : 'lost'} ${Math.abs(c.followersDelta ?? 0)} followers`).join(' · ')
    : null

  return {
    id: row.id,
    briefDate: row.date.toISOString(),
    summary: row.summary,
    topPerformer: null as string | null, // reserved for future
    competitorAlert,
    ideaOfDay: row.ideaOfDay,
    actionItems,
    generatedAt: row.generatedAt.toISOString(),
  }
}

export async function getTodayBrief(req: AuthRequest, res: Response): Promise<void> {
  const orgId = org(req)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const row = await prisma.dailyBrief.findUnique({ where: { orgId_date: { orgId, date: today } } })
  res.json({ data: { brief: row ? mapBrief(row) : null } })
}

export async function triggerBriefGeneration(req: AuthRequest, res: Response): Promise<void> {
  const orgId = org(req)
  await dailyBriefQueue.add('manual-brief', { orgId }, { priority: 1 })
  res.json({ data: { message: 'Brief generation queued' } })
}
