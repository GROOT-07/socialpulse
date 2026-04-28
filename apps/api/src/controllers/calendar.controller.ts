import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

function org(req: AuthRequest): string { return (req.headers['x-org-id'] as string) || '' }

export async function listCalendar(req: AuthRequest, res: Response): Promise<void> {
  const { from, to } = req.query as { from?: string; to?: string }
  const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(1); return d })()
  const toDate = to ? new Date(to) : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 0); return d })()
  const posts = await prisma.contentCalendar.findMany({
    where: { orgId: org(req), date: { gte: fromDate, lte: toDate } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  })
  res.json({ data: { posts } })
}

export async function createCalendarPost(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as {
    date: string; time?: string; platform: string; topic: string
    contentPillar?: string; format?: string; caption?: string; notes?: string; status?: string
  }
  const post = await prisma.contentCalendar.create({
    data: {
      orgId: org(req),
      date: new Date(body.date),
      time: body.time,
      platform: body.platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE',
      topic: body.topic,
      contentPillar: body.contentPillar,
      format: (body.format ?? 'POST') as 'REEL' | 'CAROUSEL' | 'STORY' | 'POST' | 'SHORT' | 'VIDEO',
      caption: body.caption,
      notes: body.notes,
      status: (body.status ?? 'PLANNED') as 'PLANNED' | 'PUBLISHED' | 'SKIPPED',
    },
  })
  res.status(201).json({ data: { post } })
}

export async function updateCalendarPost(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const body = req.body as {
    date?: string; time?: string; platform?: string; topic?: string
    contentPillar?: string; format?: string; caption?: string; notes?: string; status?: string
  }
  const data: Record<string, unknown> = {}
  if (body.date != null)          data['date']          = new Date(body.date)
  if (body.time != null)          data['time']          = body.time
  if (body.platform != null)      data['platform']      = body.platform
  if (body.topic != null)         data['topic']         = body.topic
  if (body.contentPillar != null) data['contentPillar'] = body.contentPillar
  if (body.format != null)        data['format']        = body.format
  if (body.caption != null)       data['caption']       = body.caption
  if (body.notes != null)         data['notes']         = body.notes
  if (body.status != null)        data['status']        = body.status
  const result = await prisma.contentCalendar.updateMany({ where: { id, orgId: org(req) }, data })
  if (!result.count) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { updated: true } })
}

export async function deleteCalendarPost(req: AuthRequest, res: Response): Promise<void> {
  await prisma.contentCalendar.deleteMany({ where: { id: req.params['id'], orgId: org(req) } })
  res.json({ data: { deleted: true } })
}
