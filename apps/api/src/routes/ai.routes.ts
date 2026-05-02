import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import { prisma } from '../lib/prisma'
import {
  gapAnalysis,
  generateIdeas,
  generateSection,
  generatePersonaHandler,
  generateVoiceHandler,
} from '../controllers/ai.controller'
import {
  generateSocialPosts,
  generateVideoScript,
  generateBlogOutline,
  generateBlogDraft,
  generateSmartCalendar,
  generateSEOBrief,
  generateTrendingIdeas,
} from '../services/ai/aiService'
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

// ── Existing AI routes (Calls 1-6) ───────────────────────────
router.get('/gap-analysis', wrapAuth(gapAnalysis))
router.post('/ideas', wrapAuth(generateIdeas))
router.post('/playbook-section', wrapAuth(generateSection))
router.post('/persona', wrapAuth(generatePersonaHandler))
router.post('/brand-voice', wrapAuth(generateVoiceHandler))

// ── Content Studio AI routes (Calls 7-13) ────────────────────

// AI CALL 7: Social Media Post Generation
router.post('/generate-post', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const { platform, contentType, topic, tone, keywords, language } = req.body as {
    platform: string
    contentType?: string
    topic: string
    tone?: string
    keywords?: string[]
    language?: string
  }
  if (!platform || !topic) { res.status(400).json({ error: 'platform and topic required' }); return }
  const posts = await generateSocialPosts(orgId, { topic, platform, tone, keywords })
  res.json({ data: { posts } })
}))

// AI CALL 8: Video/Reel Script Generation
router.post('/generate-script', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const { topic, platform, duration } = req.body as {
    topic: string
    platform: string
    duration?: string
  }
  if (!topic || !platform) { res.status(400).json({ error: 'topic and platform required' }); return }
  const script = await generateVideoScript(orgId, { topic, platform, duration })
  res.json({ data: { script } })
}))

// AI CALL 9: Blog/Article Outline + Draft (two-step)
router.post('/generate-blog/outline', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const { topic, keywords } = req.body as { topic: string; keywords?: string[] }
  if (!topic) { res.status(400).json({ error: 'topic required' }); return }
  const outline = await generateBlogOutline(orgId, { topic, keywords })
  res.json({ data: { outline } })
}))

router.post('/generate-blog/draft', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const { outline } = req.body as { outline: Parameters<typeof generateBlogDraft>[1]['outline'] }
  if (!outline) { res.status(400).json({ error: 'outline required' }); return }
  const draft = await generateBlogDraft(orgId, { outline })
  res.json({ data: { draft } })
}))

// AI CALL 12: Smart Calendar Population
router.post('/generate-calendar', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const { month, year, platforms } = req.body as {
    month: number
    year: number
    platforms?: string[]
  }
  if (!month || !year) { res.status(400).json({ error: 'month and year required' }); return }
  const calendar = await generateSmartCalendar(orgId, { month, year, platforms })
  res.json({ data: { calendar } })
}))

// AI CALL 13: SEO Content Brief
router.post('/seo-brief', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const { keyword, competitors } = req.body as { keyword: string; competitors?: string[] }
  if (!keyword) { res.status(400).json({ error: 'keyword required' }); return }
  const brief = await generateSEOBrief(orgId, { keyword, competitors })
  res.json({ data: { brief } })
}))

// Trending ideas (Call 13 variant)
router.post('/trending-ideas', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const { platform, count } = req.body as { platform?: string; count?: number }
  const ideas = await generateTrendingIdeas(orgId, { platform, count })
  res.json({ data: {