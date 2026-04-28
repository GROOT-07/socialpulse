import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

function org(req: AuthRequest): string { return (req.headers['x-org-id'] as string) || '' }

const DEFAULT_AUDIT_ITEMS: Array<{ platform: 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'; category: string; title: string }> = [
  { platform: 'INSTAGRAM', category: 'Bio', title: 'Profile photo is high-quality and on-brand' },
  { platform: 'INSTAGRAM', category: 'Bio', title: 'Bio clearly explains what you do + who you serve' },
  { platform: 'INSTAGRAM', category: 'Bio', title: 'Bio includes a call-to-action' },
  { platform: 'INSTAGRAM', category: 'Bio', title: 'Website link or Linktree is working' },
  { platform: 'INSTAGRAM', category: 'Content', title: 'Feed has 9+ posts' },
  { platform: 'INSTAGRAM', category: 'Content', title: 'Posts use consistent visual style/colors' },
  { platform: 'INSTAGRAM', category: 'Content', title: 'Highlights are organized by topic' },
  { platform: 'INSTAGRAM', category: 'Engagement', title: 'Reply to all comments within 24h' },
  { platform: 'INSTAGRAM', category: 'Engagement', title: 'DMs are checked and replied daily' },
  { platform: 'FACEBOOK', category: 'Setup', title: 'Page category is correctly set' },
  { platform: 'FACEBOOK', category: 'Setup', title: 'Cover photo is branded and sized correctly' },
  { platform: 'FACEBOOK', category: 'Setup', title: 'All contact info is filled (phone, address, hours)' },
  { platform: 'FACEBOOK', category: 'Content', title: 'Page has 5+ posts' },
  { platform: 'FACEBOOK', category: 'Content', title: 'Pinned post introduces the business' },
  { platform: 'YOUTUBE', category: 'Branding', title: 'Channel art is 2560x1440px and branded' },
  { platform: 'YOUTUBE', category: 'Branding', title: 'Channel icon matches other platforms' },
  { platform: 'YOUTUBE', category: 'About', title: 'Channel description has keywords' },
  { platform: 'YOUTUBE', category: 'Content', title: 'Channel trailer is uploaded (60-90s)' },
  { platform: 'YOUTUBE', category: 'Content', title: '3+ videos uploaded with custom thumbnails' },
]

export async function getAudit(req: AuthRequest, res: Response): Promise<void> {
  const orgId = org(req)
  let items = await prisma.auditItem.findMany({ where: { orgId }, orderBy: [{ platform: 'asc' }, { category: 'asc' }] })

  if (items.length === 0) {
    await prisma.auditItem.createMany({ data: DEFAULT_AUDIT_ITEMS.map((i) => ({ ...i, orgId })) })
    items = await prisma.auditItem.findMany({ where: { orgId }, orderBy: [{ platform: 'asc' }, { category: 'asc' }] })
  }

  res.json({ data: { items } })
}

export async function toggleAuditItem(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const item = await prisma.auditItem.findFirst({ where: { id, orgId: org(req) } })
  if (!item) { res.status(404).json({ error: 'Not found' }); return }
  const updated = await prisma.auditItem.update({ where: { id }, data: { isDone: !item.isDone, score: !item.isDone ? 100 : 0 } })
  res.json({ data: { item: updated } })
}
