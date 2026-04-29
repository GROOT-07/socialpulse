import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import { prisma } from '../lib/prisma'
import { getIndustryFeedItems, extractTrendingTopics } from '../services/rss/rssReaderService'
import type { AuthRequest } from '../middleware/auth'
import type { Response } from 'express'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

// ── GET /api/trends/rss — RSS news for the org's industry ─────

router.get('/rss', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { industry: true },
  })

  const industry = org?.industry ?? 'Other'
  const limit = Math.min(Number(req.query['limit'] ?? 20), 50)
  const items = await getIndustryFeedItems(industry, limit)

  res.json({ data: { items, industry } })
}))

// ── GET /api/trends/topics — trending topics for org ─────────

router.get('/topics', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { industry: true },
  })

  const industry = org?.industry ?? 'Other'
  const topics = await extractTrendingTopics(industry, 10)

  res.json({ data: { topics, industry } })
}))

// ── GET /api/trends/db — DB-stored trending topics for org ────

router.get('/db', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const topics = await prisma.trendingTopic.findMany({
    where: { orgId },
    orderBy: [{ searchVolume: 'desc' }, { fetchedAt: 'desc' }],
    take: 20,
  })

  res.json({ data: { topics } })
}))

// ── GET /api/trends/competitor-posts — viral competitor posts ─

router.get('/competitor-posts', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const limit = Math.min(Number(req.query['limit'] ?? 10), 30)

  // Fetch top posts from confirmed competitors in the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const posts = await prisma.competitorPost.findMany({
    where: {
      competitor: { orgId },
      engagementRate: { gt: 0 },
      postedAt: { gte: thirtyDaysAgo },
    },
    include: {
      competitor: {
        select: { businessName: true, handle: true, platform: true },
      },
    },
    orderBy: { engagementRate: 'desc' },
    take: limit,
  })

  res.json({ data: { posts } })
}))

export default router
