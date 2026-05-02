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
  res.json({ data: { ideas } })
}))

// WhatsApp message generation
router.post('/generate-whatsapp', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const { messageType, language, recipientContext, tone } = req.body as {
    messageType: string
    language?: string
    recipientContext?: string
    tone?: string
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, industry: true, city: true }
  })
  const { ask } = await import('../lib/ai/gemini')
  const text = await ask(
    `Generate a WhatsApp business message for ${org?.name ?? 'a business'}.
Type: ${messageType}
Recipient context: ${recipientContext ?? 'customer'}
Tone: ${tone ?? 'warm and professional'}
Language: ${language ?? 'English'}

Write one ready-to-send WhatsApp message. Keep it under 300 characters.
No placeholders. Make it feel personal and human.`,
    { model: 'flash', maxTokens: 512, temperature: 0.7 },
  )

  res.json({ data: { text } })
}))

// Outreach message generation
router.post('/generate-outreach', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const { audienceType, outreachGoal, additionalContext, channel } = req.body as {
    audienceType: string
    outreachGoal: string
    additionalContext?: string
    channel?: string
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, industry: true, city: true }
  })
  const { ask } = await import('../lib/ai/gemini')

  const text = await ask(
    `Generate an outreach message for ${org?.name ?? 'a business'} (${org?.industry ?? 'business'}).
Target audience: ${audienceType}
Goal: ${outreachGoal}
Channel: ${channel ?? 'WhatsApp'}
Additional context: ${additionalContext ?? ''}

Write one complete, ready-to-send outreach message.
Make it specific to the business and audience. No generic templates.`,
    { model: 'flash', maxTokens: 768, temperature: 0.7 },
  )

  res.json({ data: { text } })
}))

// Platform audit
router.post('/platform-audit', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const {
    platform,
    orgCaptions,
    orgFollowers,
    orgPostingFrequency,
    competitors,
    auditMode,
    mainConcern,
  } = req.body as {
    platform: string
    orgCaptions: string
    orgFollowers: string
    orgPostingFrequency: string
    competitors?: Array<{ handle: string; estimatedFollowers: string; captions: string }>
    auditMode?: string
    mainConcern?: string
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, industry: true, city: true }
  })
  const orgName = org?.name ?? 'Your Organization'
  const industry = org?.industry ?? 'business'

  const competitorSection = (competitors ?? []).map((c, i) =>
    `COMPETITOR ${i + 1}: @${c.handle} (~${c.estimatedFollowers} followers)\nCaptions:\n${c.captions}`
  ).join('\n\n')

  const { ask } = await import('../lib/ai/gemini')
  const text = await ask(
    `You are an expert ${platform} auditor for ${industry} businesses.

AUDIT REQUEST for: ${orgName}
Platform: ${platform}
Audit mode: ${auditMode ?? 'comprehensive'}
Main concern: ${mainConcern ?? 'overall performance'}

YOUR ORGANIZATION:
Followers: ${orgFollowers}
Posting frequency: ${orgPostingFrequency}
Sample captions:
${orgCaptions}

${competitorSection ? `COMPETITORS:\n${competitorSection}` : ''}

Provide a structured audit with these sections:
1. SCORECARD -- Rate 5 metrics (1-10): Content Quality, Consistency, Engagement, Profile Optimization, Strategy Alignment
2. PRIORITY FIXES -- Top 3 specific actions to take this week
3. CAPTION REWRITE -- Rewrite one of their sample captions to be 40% more engaging
4. 30-DAY PLAN -- 4 weekly milestones

Be specific, actionable, and reference their actual content.`,
    { model: 'pro', maxTokens: 3000, temperature: 0.5 },
  )

  res.json({ data: { audit: text } })
}))

// Daily Brief Generation
router.post('/brief', wrapAuth(async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const { force } = req.body as { force?: boolean }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (!force) {
    const existing = await prisma.dailyBrief.findFirst({
      where: { orgId, generatedAt: { gte: today } },
      orderBy: { generatedAt: 'desc' },
    })
    if (existing) {
      res.json({ data: existing, cached: true })
      return
    }
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: { contentPillars: { take: 4 } },
  })

  const [specialDays, trendingTopics, pendingChecklist] = await Promise.all([
    prisma.specialDay.findMany({
      where: {
        date: {
          gte: today,
          lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      take: 5,
    }),
    prisma.trendingTopic.findMany({
      where: { orgId },
      orderBy: { searchVolume: 'desc' },
      take: 5,
    }),
    prisma.checklistItem.findMany({
      where: { orgId, isDone: false, priority: { in: ['MUST', 'HIGH'] } },
      take: 5,
    }),
  ])

  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const pillars = org.contentPillars.map((p) => p.title).join(', ')
  const specialDayStr = specialDays.map((d) => d.name).join(', ') || 'none'
  const trendStr = trendingTopics.map((t) => t.topic).join(', ') || 'general industry trends'

  const { askJSON } = await import('../lib/ai/gemini')
  const brief = await askJSON<{
    platform: string
    format: string
    idea: string
    why: string
    hook: string
    points: string[]
    cta: string
    regional_phrase: string
  }>(
    `You are a social media content strategist for ${org.industry} businesses.

Generate today's (${dayName}, ${dateStr}) content brief for: ${org.name}
Industry: ${org.industry}
Location: ${org.city ?? ''}, ${org.country ?? 'India'}
Content pillars: ${pillars || 'Education, Engagement, Promotion, Inspiration'}
Upcoming special days this week: ${specialDayStr}
Trending now: ${trendStr}
Pending tasks: ${pendingChecklist.map((c) => c.title).join(', ') || 'none'}

Return JSON with exactly these fields:
{
  "platform": "INSTAGRAM",
  "format": "Reel",
  "idea": "specific content idea title",
  "why": "1-2 sentences on why this idea works today",
  "hook": "attention-grabbing opening line for the post",
  "points": ["point 1", "point 2", "point 3", "point 4"],
  "cta": "call to action text",
  "regional_phrase": "optional regional/cultural phrase if applicable, else empty string"
}`,
    { model: 'flash', maxTokens: 1024, temperature: 0.8 },
  )

  const saved = await prisma.dailyBrief.create({
    data: {
      orgId,
      date: today,
      summary: brief.idea,
      pendingTasks: pendingChecklist.map((c) => c.title) as unknown as JSON,
      scheduledPosts: [] as unknown as JSON,
      ideaOfDay: JSON.stringify(brief),
      generatedAt: new Date(),
    },
  })

  res.json({ data: { ...saved, brief }, cached: false })
}))

export default router
