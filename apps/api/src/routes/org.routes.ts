import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import { listOrgs, getOrg, createOrg, updateOrg, deleteOrg, switchOrg } from '../controllers/org.controller'
import {
  orgIntelligenceQueue,
  competitorDiscoveryQueue,
  seoKeywordDiscoveryQueue,
  contentStrategyQueue,
  orgSummaryQueue,
  socialProfileScanQueue,
} from '../lib/queue'
import { prisma } from '../lib/prisma'
import { aiService } from '../services/ai/aiService'
import { searchKnowledgeGraph, findPlace } from '../lib/googleApis'
import { Platform, Prisma } from '@prisma/client'
import type { Request, Response } from 'express'

const router: ReturnType<typeof Router> = Router()

const platformValues = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WHATSAPP', 'GOOGLE'] as const

const createOrgSchema = z.object({
  name: z.string().min(2).max(80),
  industry: z.string().min(1),
  city: z.string().optional(),
  country: z.string().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
})

const updateOrgSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  industry: z.string().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  logoUrl: z.string().url().optional(),
  activePlatforms: z.array(z.enum(platformValues)).optional(),
  timezone: z.string().optional(),
  // V2 fields
  website: z.string().url().optional().or(z.literal('')),
  businessType: z.enum(['LOCAL', 'REGIONAL', 'NATIONAL', 'GLOBAL']).optional(),
  language: z.string().optional(),
})

router.use(authenticate)

router.get('/', wrapAuth(listOrgs))
router.post('/', validate(createOrgSchema), wrapAuth(createOrg))
router.get('/:id', wrapAuth(getOrg))
router.patch('/:id', validate(updateOrgSchema), wrapAuth(updateOrg))
router.delete('/:id', wrapAuth(deleteOrg))
router.post('/:id/switch', wrapAuth(switchOrg))

// ── V2: Job trigger endpoints (onboarding) ────────────────────

router.post('/:id/jobs/intelligence', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }
  await orgIntelligenceQueue.add('org-intelligence', { orgId: id }, { priority: 1 })
  res.json({ queued: true, job: 'org-intelligence' })
})

router.post('/:id/jobs/competitor-discovery', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }
  await competitorDiscoveryQueue.add('competitor-discovery', { orgId: id }, { priority: 1 })
  res.json({ queued: true, job: 'competitor-discovery' })
})

router.post('/:id/jobs/seo-keywords', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }
  await seoKeywordDiscoveryQueue.add('seo-keyword-discovery', { orgId: id })
  res.json({ queued: true, job: 'seo-keyword-discovery' })
})

router.post('/:id/jobs/content-strategy', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }
  await contentStrategyQueue.add('content-strategy', { orgId: id })
  res.json({ queued: true, job: 'content-strategy' })
})

router.post('/:id/jobs/org-summary', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }
  await orgSummaryQueue.add('org-summary', { orgId: id })
  res.json({ queued: true, job: 'org-summary' })
})

router.post(
  '/:id/jobs/scan-profile',
  validate(z.object({ platform: z.string(), profileUrl: z.string() })),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string }
    const { platform, profileUrl } = req.body as { platform: string; profileUrl: string }
    const job = await socialProfileScanQueue.add('scan-profile', { orgId: id, platform, profileUrl }, { priority: 1 })
    // Return immediate placeholder — SSE will update client
    res.json({ queued: true, jobId: job.id, scan: { platform, handle: '', name: '', followers: 0, profilePicUrl: '', lastPostDate: null, engagementRate: 0, status: 'scanning' } })
  },
)

// ── V2: Get org intelligence (generates synchronously if missing) ─
router.get('/:id/intelligence', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }

  // Return cached data immediately if it exists
  const existing = await prisma.orgIntelligence.findUnique({ where: { orgId: id } })
  if (existing) {
    res.json(existing)
    return
  }

  // No data yet — generate synchronously so the UI never spins forever
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { name: true, industry: true, city: true, country: true, website: true },
  })
  if (!org) {
    res.status(404).json({ error: 'Organization not found' })
    return
  }

  try {
    // Run Google lookups in parallel (gracefully return null if keys not set)
    const [kgData, placesData] = await Promise.all([
      searchKnowledgeGraph(`${org.name} ${org.industry}`).catch(() => null),
      org.city ? findPlace(org.name, org.city).catch(() => null) : Promise.resolve(null),
    ])

    const prompt = `You are analyzing a business for a social media strategy platform.

Business: ${org.name}
Industry: ${org.industry}
Location: ${[org.city, org.country].filter(Boolean).join(', ') || 'India'}
Website: ${org.website ?? 'Not provided'}
Google data: ${JSON.stringify({ kg: kgData, places: placesData })}

Return a JSON object ONLY (no markdown, no explanation):
{
  "description": "2-3 sentence overview of what this business does and who it serves",
  "strengths": ["strength1", "strength2", "strength3"],
  "detectedKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "urgentIssues": [],
  "quickWins": []
}`

    const aiText = await aiService.complete(prompt, 600)
    const match = aiText.match(/\{[\s\S]*\}/)
    const ai = match
      ? (JSON.parse(match[0]) as {
          description: string
          strengths: string[]
          detectedKeywords: string[]
          urgentIssues: unknown[]
          quickWins: unknown[]
        })
      : {
          description: `${org.name} is a ${org.industry} business${org.city ? ` based in ${org.city}` : ''}.`,
          strengths: [],
          detectedKeywords: [org.industry.toLowerCase()],
          urgentIssues: [],
          quickWins: [],
        }

    const record = await prisma.orgIntelligence.upsert({
      where: { orgId: id },
      create: {
        orgId: id,
        googleKgData: (kgData ?? {}) as unknown as Prisma.InputJsonValue,
        googlePlacesData: (placesData ?? {}) as unknown as Prisma.InputJsonValue,
        detectedKeywords: ai.detectedKeywords ?? [],
        strengths: ai.strengths ?? [],
        urgentIssues: (ai.urgentIssues ?? []) as unknown as Prisma.InputJsonValue,
        quickWins: (ai.quickWins ?? []) as unknown as Prisma.InputJsonValue,
        aiDiagnosis: { description: ai.description } as unknown as Prisma.InputJsonValue,
        presenceScore: 0,
        lastScannedAt: new Date(),
      },
      update: {
        googleKgData: (kgData ?? {}) as unknown as Prisma.InputJsonValue,
        googlePlacesData: (placesData ?? {}) as unknown as Prisma.InputJsonValue,
        detectedKeywords: ai.detectedKeywords ?? [],
        strengths: ai.strengths ?? [],
        urgentIssues: (ai.urgentIssues ?? []) as unknown as Prisma.InputJsonValue,
        quickWins: (ai.quickWins ?? []) as unknown as Prisma.InputJsonValue,
        aiDiagnosis: { description: ai.description } as unknown as Prisma.InputJsonValue,
        lastScannedAt: new Date(),
      },
    })

    res.json(record)
  } catch (err) {
    // Even if AI fails, return a minimal record so the UI can proceed
    console.error('[intelligence] sync generation failed:', (err as Error).message)
    res.json({
      orgId: id,
      googleKgData: {},
      googlePlacesData: {},
      detectedKeywords: [org.industry.toLowerCase()],
      strengths: [],
      urgentIssues: [],
      quickWins: [],
      aiDiagnosis: { description: `${org.name} is a ${org.industry} business${org.city ? ` in ${org.city}` : ''}.` },
      presenceScore: 0,
      lastScannedAt: new Date().toISOString(),
    })
  }
})

// ── V2: Social accounts with latest metrics (for /summary) ───
router.get('/:id/accounts/summary', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }

  const accounts = await prisma.socialAccount.findMany({
    where: { orgId: id },
    include: {
      metrics: {
        orderBy: { snapshotDate: 'desc' },
        take: 2,
      },
    },
    orderBy: { connectedAt: 'asc' },
  })

  // Shape matches the SocialAccount interface in /summary page
  const data = accounts.map((acc) => ({
    id: acc.id,
    platform: acc.platform,
    handle: acc.handle,
    profileUrl: acc.profileUrl,
    connectedAt: acc.connectedAt.toISOString(),
    metrics: acc.metrics.map((m) => ({
      followers: m.followers,
      following: m.following,
      posts: m.posts,
      engagementRate: m.engagementRate,
      reach: m.reach,
      impressions: m.impressions,
      avgLikes: m.avgLikes,
      avgComments: m.avgComments,
      snapshotDate: m.snapshotDate.toISOString(),
    })),
  }))

  res.json(data)
})

// ── V2: Keyword opportunities (for /summary SEO section) ─────
router.get('/:id/keywords', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }
  const limit = Math.min(Number(req.query['limit'] ?? 20), 50)

  const keywords = await prisma.keywordOpportunity.findMany({
    where: { orgId: id },
    orderBy: [{ currentRank: 'asc' }, { searchVolume: 'desc' }],
    take: limit,
  })

  res.json(keywords)
})

// ── V2: Trending topics for this org ─────────────────────────
router.get('/:id/trending', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }
  const limit = Math.min(Number(req.query['limit'] ?? 20), 50)
  const platform = req.query['platform'] as string | undefined

  const topics = await prisma.trendingTopic.findMany({
    where: {
      orgId: id,
      ...(platform ? { platform: platform as Platform } : {}),
    },
    orderBy: { trendDelta: 'desc' },
    take: limit,
  })

  res.json(topics)
})

// ── V2: Playbook ORG_SUMMARY section (for /summary roadmap) ──
router.get('/:id/playbook/summary', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }

  const section = await prisma.playbookSection.findFirst({
    where: { orgId: id, sectionType: 'ORG_SUMMARY' },
    orderBy: { updatedAt: 'desc' },
  })

  if (!section) {
    res.status(404).json({ error: 'Summary not yet generated' })
    return
  }

  res.json({ content: section.content, updatedAt: section.updatedAt })
})

export default router
