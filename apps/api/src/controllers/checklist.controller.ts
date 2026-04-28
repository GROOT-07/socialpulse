import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

function org(req: AuthRequest): string { return (req.headers['x-org-id'] as string) || '' }

const DEFAULT_ITEMS: Array<{ platform: 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'; title: string; description: string; priority: 'MUST' | 'HIGH' | 'MEDIUM' }> = [
  { platform: 'INSTAGRAM', title: 'Add profile photo', description: 'High-quality logo or brand image', priority: 'MUST' },
  { platform: 'INSTAGRAM', title: 'Write bio with CTA', description: 'Include contact info and link', priority: 'MUST' },
  { platform: 'INSTAGRAM', title: 'Add website link or Linktree', description: 'Drive traffic to your site', priority: 'MUST' },
  { platform: 'INSTAGRAM', title: 'Post 9+ feed posts', description: 'Minimum grid for credibility', priority: 'HIGH' },
  { platform: 'INSTAGRAM', title: 'Create Instagram Highlights', description: 'Categories: About, Services, Testimonials', priority: 'HIGH' },
  { platform: 'FACEBOOK', title: 'Complete Page Info', description: 'Fill all business details', priority: 'MUST' },
  { platform: 'FACEBOOK', title: 'Add cover photo', description: 'Branded, 820x312px', priority: 'MUST' },
  { platform: 'FACEBOOK', title: 'Enable WhatsApp button', description: 'Quick contact option', priority: 'HIGH' },
  { platform: 'FACEBOOK', title: 'Post 5+ updates', description: 'Initial content for credibility', priority: 'HIGH' },
  { platform: 'YOUTUBE', title: 'Create channel art', description: 'Banner image: 2560x1440px', priority: 'MUST' },
  { platform: 'YOUTUBE', title: 'Write channel description', description: 'Keywords + value proposition', priority: 'MUST' },
  { platform: 'YOUTUBE', title: 'Add channel trailer', description: '60-90 second intro video', priority: 'HIGH' },
  { platform: 'YOUTUBE', title: 'Upload 3+ videos', description: 'Minimum content for new visitors', priority: 'HIGH' },
]

export async function getChecklist(req: AuthRequest, res: Response): Promise<void> {
  const orgId = org(req)
  let items = await prisma.checklistItem.findMany({
    where: { orgId },
    orderBy: [{ platform: 'asc' }, { priority: 'asc' }],
  })

  if (items.length === 0) {
    await prisma.checklistItem.createMany({ data: DEFAULT_ITEMS.map((i) => ({ ...i, orgId })) })
    items = await prisma.checklistItem.findMany({
      where: { orgId },
      orderBy: [{ platform: 'asc' }, { priority: 'asc' }],
    })
  }

  res.json({ data: { items } })
}

export async function toggleChecklistItem(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const item = await prisma.checklistItem.findFirst({ where: { id, orgId: org(req) } })
  if (!item) { res.status(404).json({ error: 'Not found' }); return }

  const updated = await prisma.checklistItem.update({
    where: { id },
    data: { isDone: !item.isDone, doneAt: !item.isDone ? new Date() : null },
  })
  res.json({ data: { item: updated } })
}

export async function addCustomItem(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as { platform: string; title: string; description?: string; priority?: string }
  const item = await prisma.checklistItem.create({
    data: {
      orgId: org(req),
      platform: body.platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE',
      title: body.title,
      description: body.description,
      priority: (body.priority ?? 'MEDIUM') as 'MUST' | 'HIGH' | 'MEDIUM',
      isCustom: true,
    },
  })
  res.status(201).json({ data: { item } })
}

export async function resetChecklist(req: AuthRequest, res: Response): Promise<void> {
  // platform comes from request body (route is POST /reset with no URL param)
  const { platform } = req.body as { platform?: string }
  const orgId = org(req)

  if (!platform || platform === 'all') {
    await prisma.checklistItem.updateMany({ where: { orgId }, data: { isDone: false, doneAt: null } })
  } else {
    await prisma.checklistItem.updateMany({
      where: { orgId, platform: platform.toUpperCase() as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' },
      data: { isDone: false, doneAt: null },
    })
  }
  res.json({ data: { reset: true } })
}
