/**
 * AI Service — all Gemini API calls go through here.
 * Routes all requests through the centralized Gemini router.
 * Never expose GEMINI_API_KEY to the frontend.
 */

import { ask, askJSON, flash } from '../../lib/ai/gemini'
import { prisma } from '../../lib/prisma'
import { Platform, Prisma } from '@prisma/client'

/**
 * Generic completion — for services that build their own prompts.
 * Used by CompetitorDiscoveryService, SEOIntelligenceService, and onboarding workers.
 */
export const aiService = {
  async complete(prompt: string, maxTokens = 1024): Promise<string> {
    return ask(prompt, {
      model: maxTokens <= 512 ? 'flash' : 'pro',
      maxTokens,
      systemPrompt: 'You are a helpful expert assistant. Respond concisely and accurately. When asked for JSON, return only valid JSON with no markdown fences.',
    })
  },
}

// ── 1. Gap Analysis ───────────────────────────────────────────

export interface GapAnalysisResult {
  beatingYou: Array<{ competitor: string; metric: string; theirValue: string; yourValue: string; insight: string }>
  untappedAdvantages: Array<{ area: string; description: string }>
  contentGaps: Array<{ format: string; competitorUsage: string; recommendation: string }>
  recommendedActions: Array<{ priority: number; action: string; rationale: string; expectedImpact: string }>
  competitiveMoat: Array<{ strength: string; description: string }>
}

export async function generateGapAnalysis(orgId: string): Promise<GapAnalysisResult> {
  const [org, competitors, socialAccounts] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, include: { voiceProfile: true } }),
    prisma.competitor.findMany({
      where: { orgId },
      include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 1 } },
    }),
    prisma.socialAccount.findMany({
      where: { orgId },
      include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 1 } },
    }),
  ])

  if (!org) throw new Error('Organization not found')

  const orgMetrics = socialAccounts.map((a) => ({
    platform: a.platform,
    followers: a.metrics[0]?.followers ?? 0,
    engagementRate: a.metrics[0]?.engagementRate ?? 0,
    reach: a.metrics[0]?.reach ?? 0,
  }))

  const competitorData = competitors.map((c) => ({
    handle: c.handle,
    platform: c.platform,
    followers: c.metrics[0]?.followers ?? 0,
    engagementRate: c.metrics[0]?.engagementRate ?? 0,
    avgLikes: c.metrics[0]?.avgLikes ?? 0,
    avgComments: c.metrics[0]?.avgComments ?? 0,
  }))

  const prompt = `Analyze this social media competitive landscape and generate a gap analysis for "${org.name}" (industry: ${org.industry}).

YOUR ORG METRICS:
${JSON.stringify(orgMetrics, null, 2)}

COMPETITOR METRICS:
${JSON.stringify(competitorData, null, 2)}

Return a JSON object with this exact structure:
{
  "beatingYou": [{"competitor": "handle", "metric": "followers", "theirValue": "61.5K", "yourValue": "48.2K", "insight": "why this matters"}],
  "untappedAdvantages": [{"area": "engagement rate", "description": "your 4.7% beats industry avg of 3.2%"}],
  "contentGaps": [{"format": "Reels", "competitorUsage": "Competitor A posts 3 Reels/week", "recommendation": "Post 2 Reels/week to close gap"}],
  "recommendedActions": [{"priority": 1, "action": "specific action", "rationale": "why", "expectedImpact": "measurable outcome"}],
  "competitiveMoat": [{"strength": "local audience trust", "description": "why you should double down here"}]
}

Return ONLY valid JSON, no markdown.`

  const result = await askJSON<GapAnalysisResult>(prompt, { model: 'pro', maxTokens: 2048 })

  await prisma.playbookSection.upsert({
    where: { orgId_sectionType: { orgId, sectionType: 'STRATEGY' } },
    update: { content: result as unknown as Prisma.InputJsonValue, generatedByAI: true },
    create: { orgId, sectionType: 'STRATEGY', content: result as unknown as Prisma.InputJsonValue, generatedByAI: true },
  })

  return result
}

// ── 2. Content Ideas ──────────────────────────────────────────

export interface ContentIdea {
  title: string
  description: string
  platform: string
  pillarId: string | null
  captionStarter: string
}

export async function generateContentIdeas(orgId: string, count = 5): Promise<ContentIdea[]> {
  const [org, pillars, personas, competitors] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.contentPillar.findMany({ where: { orgId } }),
    prisma.persona.findMany({ where: { orgId }, take: 2 }),
    prisma.competitor.findMany({
      where: { orgId },
      include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 1 } },
      take: 3,
    }),
  ])

  if (!org) throw new Error('Organization not found')

  const prompt = `Generate ${count} unique content ideas for "${org.name}" (industry: ${org.industry}).

PLATFORMS: ${org.activePlatforms.join(', ')}
CONTENT PILLARS: ${pillars.map((p) => `${p.title}: ${p.description}`).join('\n')}
TARGET PERSONAS: ${personas.map((p) => `${p.name}, ${p.ageRange}, interests: ${p.interests.join(', ')}`).join('\n')}
COMPETITORS TO BEAT: ${competitors.map((c) => c.handle).join(', ')}

Return a JSON array:
[{"title": "Post title", "description": "Brief description", "platform": "INSTAGRAM", "pillarId": null, "captionStarter": "Did you know..."}]

Return ONLY the JSON array.`

  return askJSON<ContentIdea[]>(prompt, { model: 'flash', maxTokens: 1024 })
}

// ── 3. Playbook Section ───────────────────────────────────────

export async function generatePlaybookSection(orgId: string, sectionType: string): Promise<string> {
  const [org, goals, personas, pillars, voice] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.goal.findMany({ where: { orgId, status: 'ACTIVE' }, take: 5 }),
    prisma.persona.findMany({ where: { orgId } }),
    prisma.contentPillar.findMany({ where: { orgId } }),
    prisma.brandVoice.findUnique({ where: { orgId } }),
  ])

  if (!org) throw new Error('Organization not found')

  const prompt = `You are a senior social media strategist writing a brand playbook. Be specific and actionable.

Write a "${sectionType}" section for the social media playbook of "${org.name}" (${org.industry}).

CONTEXT:
- Active platforms: ${org.activePlatforms.join(', ')}
- Goals: ${goals.map((g) => `${g.title}: target ${g.targetValue} ${g.unit}`).join(', ')}
- Brand voice: ${voice?.adjectives.join(', ') ?? 'professional, helpful'}
- Personas: ${personas.map((p) => p.name).join(', ')}
- Content pillars: ${pillars.map((p) => p.title).join(', ')}

Write 3-5 paragraphs of actionable, specific strategy content for this section. Return plain text (no JSON).`

  const text = await ask(prompt, { model: 'pro', maxTokens: 2048 })

  await prisma.playbookSection.upsert({
    where: { orgId_sectionType: { orgId, sectionType: sectionType as 'BRAND_VOICE' | 'STRATEGY' | 'POSTING_GUIDE' | 'OUTREACH' } },
    update: { content: { text } as unknown as Prisma.InputJsonValue, generatedByAI: true },
    create: { orgId, sectionType: sectionType as 'BRAND_VOICE' | 'STRATEGY' | 'POSTING_GUIDE' | 'OUTREACH', content: { text } as unknown as Prisma.InputJsonValue, generatedByAI: true },
  })

  return text
}

// ── 4. Daily Brief ────────────────────────────────────────────

export async function generateDailyBrief(orgId: string): Promise<void> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const [org, calendarToday, pendingChecklist, metrics, competitorChanges] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.contentCalendar.findMany({ where: { orgId, date: today, status: 'PLANNED' } }),
    prisma.checklistItem.findMany({ where: { orgId, isDone: false }, orderBy: { priority: 'asc' }, take: 5 }),
    prisma.socialAccount.findMany({ where: { orgId }, include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 2 } } }),
    prisma.competitor.findMany({ where: { orgId }, include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 2 } }, take: 3 }),
  ])

  if (!org) return

  const metricsContext = metrics.map((a) => {
    const [latest, prev] = a.metrics
    return { platform: a.platform, followers: latest?.followers ?? 0, followersDelta: latest && prev ? latest.followers - prev.followers : 0, engagementRate: latest?.engagementRate ?? 0 }
  })

  const competitorContext = competitorChanges.map((c) => {
    const [latest, prev] = c.metrics
    return { handle: c.handle, platform: c.platform, followersDelta: latest && prev ? latest.followers - prev.followers : 0, followers: latest?.followers ?? 0 }
  }).filter((c) => Math.abs(c.followersDelta) > 100)

  const prompt = `You are a social media manager writing a daily team brief. Be concise, motivating, and specific.

Write a brief morning summary (3-5 sentences) for "${org.name}"'s social media team.

TODAY'S SCHEDULED POSTS: ${calendarToday.length > 0 ? calendarToday.map((p) => `${p.platform}: ${p.topic}`).join(', ') : 'None scheduled'}
PENDING TASKS: ${pendingChecklist.length} items (top: ${pendingChecklist[0]?.title ?? 'none'})
METRICS SNAPSHOT: ${metricsContext.map((m) => `${m.platform}: ${m.followers} followers (${m.followersDelta >= 0 ? '+' : ''}${m.followersDelta} today)`).join(', ')}
COMPETITOR ALERTS: ${competitorContext.length > 0 ? competitorContext.map((c) => `${c.handle} gained ${c.followersDelta} followers`).join(', ') : 'No significant changes'}

Write a motivating, actionable brief. Return plain text only.`

  const summary = await ask(prompt, { model: 'flash', maxTokens: 512 })

  const ideaResult = await generateContentIdeas(orgId, 1)
  const ideaOfDay = ideaResult[0]?.captionStarter ?? null

  await prisma.dailyBrief.upsert({
    where: { orgId_date: { orgId, date: today } },
    update: {
      summary,
      pendingTasks: pendingChecklist as object[],
      scheduledPosts: calendarToday as object[],
      ideaOfDay,
      competitorPulse: competitorContext as object[],
    },
    create: {
      orgId,
      date: today,
      summary,
      pendingTasks: pendingChecklist as object[],
      scheduledPosts: calendarToday as object[],
      ideaOfDay,
      competitorPulse: competitorContext as object[],
    },
  })
}

// ── 5. Persona Generation ─────────────────────────────────────

export interface GeneratedPersona {
  name: string
  ageRange: string
  gender: string
  location: string
  interests: string[]
  painPoints: string[]
  contentPreference: string
  platforms: string[]
}

export async function generatePersona(orgId: string, demographics: { ageRange?: string; gender?: string; location?: string }): Promise<GeneratedPersona> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) throw new Error('Organization not found')

  const prompt = `Create a detailed audience persona for "${org.name}" (${org.industry}).
Demographics hint: age ${demographics.ageRange ?? 'any'}, gender ${demographics.gender ?? 'any'}, location ${demographics.location ?? 'any'}.

Return JSON:
{"name": "Sarah M.", "ageRange": "28-35", "gender": "Female", "location": "Dubai, UAE", "interests": ["health", "family"], "painPoints": ["no time to research"], "contentPreference": "Short videos and infographics", "platforms": ["INSTAGRAM", "FACEBOOK"]}

Return ONLY the JSON.`

  return askJSON<GeneratedPersona>(prompt, { model: 'flash', maxTokens: 512 })
}

// ── 6. Brand Voice ────────────────────────────────────────────

export interface GeneratedBrandVoice {
  adjectives: string[]
  personality: string
  dos: string[]
  donts: string[]
  toneByPlatform: Record<string, string>
  captionGood: string
  captionBad: string
}

export async function generateBrandVoice(orgId: string): Promise<GeneratedBrandVoice> {
  const [org, personas] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.persona.findMany({ where: { orgId }, take: 3 }),
  ])

  if (!org) throw new Error('Organization not found')

  const prompt = `Generate a brand voice profile for "${org.name}" (${org.industry}).
Target audience: ${personas.map((p) => `${p.name}, ${p.ageRange}`).join('; ')}
Active platforms: ${org.activePlatforms.join(', ')}

Return JSON:
{"adjectives": ["Warm","Expert","Local","Trustworthy","Clear"], "personality": "The Helpful Expert", "dos": ["Use simple language"], "donts": ["Use jargon"], "toneByPlatform": {"INSTAGRAM": "casual and visual", "FACEBOOK": "informative and community-focused"}, "captionGood": "example good caption here", "captionBad": "example bad caption here"}

Return ONLY the JSON.`

  return askJSON<GeneratedBrandVoice>(prompt, { model: 'pro', maxTokens: 1024 })
}

// ── 7. Post Generator (3 variations) ─────────────────────────

export interface GeneratedPost {
  variation: number
  caption: string
  hashtags: string[]
  callToAction: string
  seoScore: number
  tone: string
  estimatedReach: string
}

export async function generateSocialPosts(
  orgId: string,
  params: { topic: string; platform: string; tone?: string; keywords?: string[] },
): Promise<GeneratedPost[]> {
  const [org, voice, pillars] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.brandVoice.findFirst({ where: { orgId } }),
    prisma.contentPillar.findMany({ where: { orgId }, take: 3 }),
  ])
  if (!org) throw new Error('Organization not found')

  const prompt = `Generate 3 distinct social media post variations for "${org.name}" (${org.industry}) for ${params.platform}.

Topic: ${params.topic}
Tone: ${params.tone ?? (voice?.adjectives as string[] | null)?.[0] ?? 'professional'}
Content pillars: ${pillars.map((p) => p.title).join(', ')}
Keywords to include: ${(params.keywords ?? []).join(', ')}
City: ${org.city ?? 'India'}

Return JSON array of 3 objects:
[{"variation":1,"caption":"full post text","hashtags":["#tag1","#tag2"],"callToAction":"Follow for more tips!","seoScore":78,"tone":"inspirational","estimatedReach":"2K-5K"},...]

Return ONLY the JSON array.`

  return askJSON<GeneratedPost[]>(prompt, { model: 'pro', maxTokens: 2048 })
}

// ── 8. Video / Reel Script Generator ─────────────────────────

export interface VideoScript {
  hook: string
  sections: Array<{ timestamp: string; voiceover: string; visualSuggestion: string }>
  callToAction: string
  duration: string
  contentType: 'REEL' | 'YOUTUBE_SHORT' | 'YOUTUBE_VIDEO'
  hashtags: string[]
}

export async function generateVideoScript(
  orgId: string,
  params: { topic: string; platform: string; duration?: string },
): Promise<VideoScript> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) throw new Error('Organization not found')

  const isShort = params.platform === 'INSTAGRAM' || params.duration === '60s'
  const prompt = `You are an expert video script writer for social media. Write punchy, engaging scripts optimized for the platform.

Write a ${isShort ? '30-60 second short-form' : '3-5 minute YouTube'} video script for "${org.name}" (${org.industry}).

Topic: ${params.topic}
Platform: ${params.platform}
Target city/region: ${org.city ?? 'India'}

Return JSON:
{"hook":"Opening line (grab attention in 3s)","sections":[{"timestamp":"0:00-0:05","voiceover":"exact words to say","visualSuggestion":"what to show on screen"},...],"callToAction":"Subscribe and follow","duration":"${params.duration ?? '45s'}","contentType":"${isShort ? 'REEL' : 'YOUTUBE_VIDEO'}","hashtags":["#tag1"]}

Return ONLY the JSON.`

  return askJSON<VideoScript>(prompt, { model: 'pro', maxTokens: 2048 })
}

// ── 9. Blog / Article Writer ──────────────────────────────────

export interface BlogOutline {
  title: string
  metaDescription: string
  slug: string
  sections: Array<{ heading: string; subpoints: string[]; estimatedWords: number }>
  targetKeywords: string[]
  estimatedReadTime: string
}

export interface BlogDraft {
  title: string
  metaDescription: string
  slug: string
  content: string
  wordCount: number
  targetKeywords: string[]
  readingTime: string
}

export async function generateBlogOutline(
  orgId: string,
  params: { topic: string; keywords?: string[] },
): Promise<BlogOutline> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) throw new Error('Organization not found')

  const prompt = `Create a detailed SEO blog outline for "${org.name}" (${org.industry}).

Topic: ${params.topic}
Target keywords: ${(params.keywords ?? []).join(', ')}
City/region: ${org.city ?? 'India'}

Return JSON:
{"title":"SEO-optimized title","metaDescription":"150-160 char meta","slug":"url-friendly-slug","sections":[{"heading":"H2 heading","subpoints":["point 1","point 2"],"estimatedWords":200},...],"targetKeywords":["kw1","kw2"],"estimatedReadTime":"5 min read"}

Return ONLY the JSON.`

  return askJSON<BlogOutline>(prompt, { model: 'pro', maxTokens: 1024 })
}

export async function generateBlogDraft(
  orgId: string,
  params: { outline: BlogOutline },
): Promise<BlogDraft> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) throw new Error('Organization not found')

  const prompt = `You are an expert SEO content writer. Write engaging, well-structured blog posts optimized for search engines.

Write a complete SEO-optimized blog post for "${org.name}" (${org.industry}).

Title: ${params.outline.title}
Target keywords: ${params.outline.targetKeywords.join(', ')}
Outline:
${params.outline.sections.map((s, i) => `${i + 1}. ${s.heading}\n   - ${s.subpoints.join('\n   - ')}`).join('\n')}

Write the full article (~${params.outline.sections.reduce((a, s) => a + s.estimatedWords, 0)} words).
Use markdown formatting with H2/H3 headings.
Naturally weave in keywords without stuffing.

Return JSON:
{"title":"${params.outline.title}","metaDescription":"${params.outline.metaDescription}","slug":"${params.outline.slug}","content":"full markdown content here","wordCount":1200,"targetKeywords":["kw1"],"readingTime":"5 min read"}

Return ONLY the JSON.`

  return askJSON<BlogDraft>(prompt, { model: 'pro', maxTokens: 4096 })
}

// ── 11. Smart Calendar Generator ─────────────────────────────

export interface CalendarPost {
  date: string
  platform: string
  topic: string
  type: string
  caption: string
  hashtags: string[]
  specialDayRef: string | null
}

export async function generateSmartCalendar(
  orgId: string,
  params: { month: number; year: number; platforms?: string[] },
): Promise<CalendarPost[]> {
  const [org, pillars, specialDays] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.contentPillar.findMany({ where: { orgId }, take: 5 }),
    prisma.specialDay.findMany({
      where: {
        date: {
          gte: new Date(params.year, params.month - 1, 1),
          lt: new Date(params.year, params.month, 1),
        },
      },
      orderBy: { date: 'asc' },
    }),
  ])
  if (!org) throw new Error('Organization not found')

  const platforms = params.platforms ?? org.activePlatforms
  const daysInMonth = new Date(params.year, params.month, 0).getDate()

  const prompt = `You are a social media content calendar expert. Create varied, engaging content that aligns with the brand.

Generate a 30-day social media content calendar for "${org.name}" (${org.industry}).

Month: ${new Date(params.year, params.month - 1).toLocaleString('en', { month: 'long' })} ${params.year}
Platforms: ${platforms.join(', ')}
Content pillars: ${pillars.map((p) => p.title).join(', ')}
Special days this month: ${specialDays.map((d) => `${d.date.toISOString().split('T')[0]}: ${d.name}`).join(', ')}
Days in month: ${daysInMonth}
Post frequency: 1 post per day per active platform

Return JSON array. For each post:
{"date":"YYYY-MM-DD","platform":"INSTAGRAM","topic":"topic title","type":"CAROUSEL|REEL|STORY|POST|VIDEO","caption":"full caption text","hashtags":["#tag"],"specialDayRef":"Diwali|null"}

Return ONLY the JSON array.`

  return askJSON<CalendarPost[]>(prompt, { model: 'pro', maxTokens: 4096 })
}

// ── 12. SEO Content Brief ─────────────────────────────────────

export interface SEOBrief {
  keyword: string
  searchIntent: string
  contentType: string
  titleOptions: string[]
  outline: Array<{ heading: string; notes: string }>
  competitorInsights: Array<{ url: string; strength: string }>
  internalLinkOpportunities: string[]
  estimatedWordCount: number
  targetFeaturedSnippet: boolean
}

export async function generateSEOBrief(
  orgId: string,
  params: { keyword: string; competitors?: string[] },
): Promise<SEOBrief> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) throw new Error('Organization not found')

  const prompt = `Create a detailed SEO content brief for "${org.name}" (${org.industry}).

Target keyword: ${params.keyword}
Business city: ${org.city ?? 'India'}
Competitors: ${(params.competitors ?? []).join(', ')}

Return JSON:
{"keyword":"${params.keyword}","searchIntent":"informational|transactional|navigational","contentType":"blog|landing page|FAQ","titleOptions":["Title A","Title B","Title C"],"outline":[{"heading":"H2 section","notes":"what to cover"}],"competitorInsights":[{"url":"competitor.com","strength":"what they do well"}],"internalLinkOpportunities":["link to page X"],"estimatedWordCount":1500,"targetFeaturedSnippet":true}

Return ONLY the JSON.`

  return askJSON<SEOBrief>(prompt, { model: 'pro', maxTokens: 1024 })
}

// ── 13. Trending Content Ideas ────────────────────────────────

export interface TrendingIdea {
  trend: string
  platform: string
  contentAngle: string
  captionHook: string
  hashtags: string[]
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
  estimatedViralScore: number
}

export async function generateTrendingIdeas(
  orgId: string,
  params: { platform?: string; count?: number },
): Promise<TrendingIdea[]> {
  const [org, trendingTopics] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.trendingTopic.findMany({
      where: { ...(params.platform ? { platform: params.platform as Platform } : {}) },
      orderBy: { trendDelta: 'desc' },
      take: 20,
    }),
  ])
  if (!org) throw new Error('Organization not found')

  const count = params.count ?? 10
  const platform = params.platform ?? 'ALL'

  const prompt = `You are a viral content strategist. Identify trends and translate them into actionable content ideas for local businesses.

Generate ${count} trending content ideas for "${org.name}" (${org.industry}) targeting ${platform} platform.

Current trending topics/hashtags: ${trendingTopics.map((t) => `${t.topic} (delta: ${t.trendDelta}%)`).join(', ')}
City/region: ${org.city ?? 'India'}
Industry: ${org.industry}

For each idea, give a specific angle the business can use RIGHT NOW.

Return JSON array:
[{"trend":"current trend name","platform":"INSTAGRAM","contentAngle":"specific angle for this business","captionHook":"First line of caption","hashtags":["#tag1","#tag2"],"urgency":"HIGH|MEDIUM|LOW","estimatedViralScore":82},...]

Return ONLY the JSON array.`

  return askJSON<TrendingIdea[]>(prompt, { model: 'pro', maxTokens: 2048 })
}
