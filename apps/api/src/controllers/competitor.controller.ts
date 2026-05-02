import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { competitorSyncQueue, competitorDiscoveryQueue } from '../lib/queue'
import { deepResearchOrg } from '../services/intelligence/deepResearchService'
import {
  getInstagramCompetitorPosts,
  getFacebookCompetitorPosts,
  getYouTubeCompetitorPosts,
} from '../services/competitor/data365Service'

function orgId(req: AuthRequest): string | null { return (req.headers['x-org-id'] as string) || null }

// Maps a DB Competitor row → the frontend Competitor interface shape
function mapCompetitor(c: {
  id: string
  handle: string
  platform: string
  profileUrl: string | null
  addedAt: Date
  metrics: Array<{
    id: string
    competitorId: string
    snapshotDate: Date
    followers: number
    engagementRate: number
    avgLikes: number
    avgComments: number
    topPostUrl: string | null
  }>
}) {
  const latest = c.metrics[0] ?? null
  const prev = c.metrics[1] ?? null
  return {
    id: c.id,
    name: c.handle,       // no separate name field in schema — use handle
    handle: c.handle,
    platform: c.platform,
    profileUrl: c.profileUrl,
    avatarUrl: null,      // not stored — populated by future enrichment
    isActive: true,
    createdAt: c.addedAt.toISOString(),
    followersDelta: latest && prev ? latest.followers - prev.followers : 0,
    latestMetrics: latest
      ? {
          id: latest.id,
          competitorId: latest.competitorId,
          snapshotDate: latest.snapshotDate.toISOString(),
          followers: latest.followers,
          following: null,
          posts: null,
          engagementRate: latest.engagementRate,
          avgLikes: latest.avgLikes,
          avgComments: latest.avgComments,
          avgViews: null,
        }
      : null,
  }
}

export async function listCompetitors(req: AuthRequest, res: Response): Promise<void> {
  const id = orgId(req)
  if (!id) { res.status(400).json({ error: 'x-org-id required' }); return }

  const statusFilter = req.query['status'] as string | undefined

  let competitors = await prisma.competitor.findMany({
    where: {
      orgId: id,
      ...(statusFilter ? { status: statusFilter as 'PENDING' | 'CONFIRMED' | 'DISMISSED' } : {}),
    },
    include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 2 } },
    orderBy: [{ relevanceScore: 'desc' }, { addedAt: 'asc' }],
  })

  // Auto-generate via Claude if empty (first load)
  if (competitors.length === 0 && !statusFilter) {
    try {
      await deepResearchOrg(id)
      competitors = await prisma.competitor.findMany({
        where: { orgId: id },
        include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 2 } },
        orderBy: [{ relevanceScore: 'desc' }, { addedAt: 'asc' }],
      })
    } catch (err) {
      console.warn('[competitors] deepResearch auto-generate failed:', (err as Error).message)
    }
  }

  // For onboarding step 3: return raw format with v2 fields
  if (req.query['format'] === 'discovery') {
    res.json(competitors.map((c) => ({
      id: c.id,
      businessName: c.businessName ?? c.handle,
      platform: c.platform,
      handle: c.handle,
      logoUrl: c.logoUrl,
      address: c.address,
      website: c.website,
      relevanceScore: c.relevanceScore,
      discoveryReason: c.discoveryReason ?? 'AI-discovered competitor',
      status: c.status,
    })))
    return
  }

  res.json({ data: { competitors: competitors.map(mapCompetitor) } })
}

export async function getCompetitor(req: AuthRequest, res: Response): Promise<void> {
  const id = orgId(req)
  const { id: cId } = req.params
  const c = await prisma.competitor.findFirst({
    where: { id: cId, orgId: id ?? '' },
    include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 2 } },
  })
  if (!c) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { competitor: mapCompetitor(c) } })
}

export async function addCompetitor(req: AuthRequest, res: Response): Promise<void> {
  const id = orgId(req)
  if (!id) { res.status(400).json({ error: 'x-org-id required' }); return }

  const { handle, platform } = req.body as { handle: string; platform: 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'; name?: string }
  if (!handle || !platform) { res.status(400).json({ error: 'handle and platform required' }); return }

  const count = await prisma.competitor.count({ where: { orgId: id, platform } })
  if (count >= 5) { res.status(400).json({ error: 'Maximum 5 competitors per platform' }); return }

  const c = await prisma.competitor.upsert({
    where: { orgId_platform_handle: { orgId: id, platform, handle } },
    update: {},
    create: { orgId: id, platform, handle },
    include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 2 } },
  })

  await competitorSyncQueue.add('initial-sync', { competitorId: c.id }, { priority: 1 })
  res.status(201).json({ data: { competitor: mapCompetitor(c) } })
}

export async function updateCompetitor(req: AuthRequest, res: Response): Promise<void> {
  const id = orgId(req)
  const { id: cId } = req.params
  const { handle, status } = req.body as { handle?: string; status?: 'CONFIRMED' | 'DISMISSED' | 'PENDING' }

  const existing = await prisma.competitor.findFirst({ where: { id: cId, orgId: id ?? '' } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const c = await prisma.competitor.update({
    where: { id: cId },
    data: {
      ...(handle !== undefined && { handle }),
      ...(status !== undefined && { status }),
    },
    include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 2 } },
  })
  res.json({ data: { competitor: mapCompetitor(c) } })
}

export async function removeCompetitor(req: AuthRequest, res: Response): Promise<void> {
  const id = orgId(req)
  const { id: cId } = req.params
  const competitor = await prisma.competitor.findFirst({ where: { id: cId, orgId: id ?? '' } })
  if (!competitor) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.competitor.delete({ where: { id: cId } })
  res.json({ data: { message: 'Competitor removed' } })
}

export async function triggerCompetitorSync(req: AuthRequest, res: Response): Promise<void> {
  const { id: cId } = req.params
  await competitorSyncQueue.add('manual-sync', { competitorId: cId }, { priority: 1 })
  res.json({ data: { message: 'Sync queued' } })
}

export async function getCompetitorPosts(req: AuthRequest, res: Response): Promise<void> {
  const { id: cId } = req.params
  const competitor = await prisma.competitor.findUnique({ where: { id: cId } })
  if (!competitor) { res.status(404).json({ error: 'Not found' }); return }

  let posts
  if (competitor.platform === 'INSTAGRAM') posts = await getInstagramCompetitorPosts(competitor.handle, 20)
  else if (competitor.platform === 'FACEBOOK') posts = await getFacebookCompetitorPosts(competitor.handle, 20)
  else posts = await getYouTubeCompetitorPosts(competitor.handle, 20)

  res.json({ data: { posts } })
}

// ── Rediscover: trigger CompetitorDiscoveryJob for the org ───

export async function rediscoverCompetitors(req: AuthRequest, res: Response): Promise<void> {
  const id = orgId(req)
  if (!id) { res.status(400).json({ error: 'x-org-id required' }); return }

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }

  // Run deep research synchronously — populates competitors immediately
  try {
    await deepResearchOrg(id)
    const competitors = await prisma.competitor.findMany({
      where: { orgId: id },
      include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 2 } },
      orderBy: [{ relevanceScore: 'desc' }],
    })
    res.json({ data: { competitors: competitors.map(mapCompetitor), message: `Found ${competitors.length} competitors via AI research.` } })
  } catch (err) {
    res.status(500).json({ error: 'Research failed', message: (err as Error).message })
  }
}

// ── Update competitor status (confirm / dismiss) ──────────────

export async function updateCompetitorStatus(req: AuthRequest, res: Response): Promise<void> {
  const id = orgId(req)
  const { id: cId } = req.params
  const { status } = req.body as { status: 'CONFIRMED' | 'DISMISSED' | 'PENDING' }

  if (!status || !['CONFIRMED', 'DISMISSED', 'PENDING'].includes(status)) {
    res.status(400).json({ error: 'status must be CONFIRMED | DISMISSED | PENDING' })
    return
  }

  const existing = await prisma.competitor.findFirst({ where: { id: cId, orgId: id ?? '' } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const c = await prisma.competitor.update({
    where: { id: cId },
    data: { status },
    include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 2 } },
  })
  res.json({ data: { competitor: mapCompetitor(c) } })
}

// ── Get last discovery timestamp for org ─────────────────────

export async function getDiscoveryMeta(req: AuthRequest, res: Response): Promise<void> {
  const id = orgId(req)
  if (!id) { res.status(400).json({ error: 'x-org-id required' }); return }

  // Most recent competitor added = proxy for last discovery run
  const latest = await prisma.competitor.findFirst({
    where: { orgId: id },
    orderBy: { addedAt: 'desc' },
    select: { addedAt: true },
  })

  const counts = await prisma.competitor.groupBy({
    by: ['status'],
    where: { orgId: id },
    _count: true,
  })

  const statusMap = Object.fromEntries(counts.map((r) => [r.status, r._count]))

  res.json({
    data: {
      lastDiscoveryAt: latest?.addedAt ?? null,
      counts: {
        tota