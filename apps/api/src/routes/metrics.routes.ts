import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  getOverviewMetrics,
  getPlatformMetrics,
  getKpiMetrics,
} from '../controllers/metrics.controller'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from '../middleware/auth'
import type { Response } from 'express'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

router.get('/kpis', wrapAuth(getKpiMetrics))
router.get('/overview', wrapAuth(getOverviewMetrics))

// ── WhatsApp metrics (stub — returns null until WA API connected) ──

router.get('/whatsapp', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  // TODO: Integrate WhatsApp Business API metrics when credentials are available
  res.json({ data: { metrics: null } })
}))

// ── SEO summary for the org ───────────────────────────────────

router.get('/seo/summary', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const [intelligence, keywords] = await Promise.all([
    prisma.orgIntelligence.findUnique({
      where: { orgId },
      select: { presenceScore: true, googleKgData: true, googlePlacesData: true },
    }),
    prisma.keywordOpportunity.findMany({
      where: { orgId },
      select: { currentRank: true, category: true },
    }),
  ])

  if (!intelligence && keywords.length === 0) {
    res.json({ data: { summary: null } })
    return
  }

  const rankingKeywords = keywords.filter((k) => k.currentRank !== null)
  const top3 = rankingKeywords.filter((k) => k.currentRank !== null && k.currentRank! <= 3).length
  const top10 = rankingKeywords.filter((k) => k.currentRank !== null && k.currentRank! <= 10).length
  const avgPosition = rankingKeywords.length > 0
    ? rankingKeywords.reduce((s, k) => s + (k.currentRank ?? 0), 0) / rankingKeywords.length
    : null

  const placesData = intelligence?.googlePlacesData as {
    rating?: number
    userRatingsTotal?: number
    place_id?: string
  } | null

  res.json({
    data: {
      summary: {
        presenceScore: intelligence?.presenceScore ?? 0,
        organicKeywords: rankingKeywords.length,
        avgPosition,
        top3Keywords: top3,
        top10Keywords: top10,
        opportunities: keywords.filter((k) => k.currentRank === null).length,
        googleBusinessClaimed: !!placesData?.place_id,
        googleRating: placesData?.rating ?? null,
        googleReviews: placesData?.userRatingsTotal ?? null,
      },
    },
  })
}))

// ── SEO keyword list (rankings or opportunities) ──────────────

router.get('/seo/keywords', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const type = (req.query['type'] as string) ?? 'ranking'
  const limit = Math.min(Number(req.query['limit'] ?? 50), 100)

  const keywords = await prisma.keywordOpportunity.findMany({
    where: {
      orgId,
      ...(type === 'opportunity' ? { currentRank: null } : { currentRank: { not: null } }),
    },
    orderBy: type === 'opportunity'
      ? [{ searchVolume: 'desc' }]
      : [{ currentRank: 'asc' }],
    take: limit,
  })

  res.json({ data: { keywords } })
}))

// ── Platform metrics (must be last — catches :platform param) ──
router.get('/:platform', wrapAuth(getPlatformMetrics))

export default router
