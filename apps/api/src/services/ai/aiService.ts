/**
 * AI Service — all Claude API calls go through here.
 * Never expose ANTHROPIC_API_KEY to the frontend.
 */

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../lib/prisma'

const MODEL = 'claude-sonnet-4-20250514'

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  return new Anthropic({ apiKey })
}

async function ask(prompt: string, systemPrompt?: string): Promise<string> {
  const client = getClient()
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt ?? 'You are a social media strategy expert. Always respond with valid JSON when asked.',
    messages: [{ role: 'user', content: prompt }],
  })
  const block = msg.content[0]
  if (!block || block.type !== 'text') throw new Error('No text response from Claude')
  return block.text
}

function parseJSON<T>(text: string): T {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  const raw = match ? match[1] ?? match[0] : text
  return JSON.parse(raw.trim()) as T
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

  const prompt = `
Analyze this social media competitive landscape and generate a gap analysis for "${org.name}" (industry: ${org.industry}).

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

Return ONLY the JSON, no markdown.`

  const text = await ask(prompt)
  const result = parseJSON<GapAnalysisResult>(text)

  await prisma.playbookSection.upsert({
    where: { orgId_sectionType: { orgId, sectionType: 'STRATEGY' } },
    update: { content: result as object, generatedByAI: true },
    create: { orgId, sectionType: 'STRATEGY', content: result as object, generatedByAI: true },
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

  const prompt = `
Generate ${count} unique content ideas for "${org.name}" (industry: ${org.industry}).

PLATFORMS: ${org.activePlatforms.join(', ')}
CONTENT PILLARS: ${pillars.map((p) => `${p.title}: ${p.description}`).join('\n')}
TARGET PERSONAS: ${personas.map((p) => `${p.name}, ${p.ageRange}, interests: ${p.interests.join(', ')}`).join('\n')}
COMPETITORS TO BEAT: ${competitors.map((c) => c.handle).join(', ')}

Return a JSON array:
[{"title": "Post title", "description": "Brief description", "platform": "INSTAGRAM", "pillarId": null, "captionStarter": "Did you know..."}]

Return ONLY the JSON array.`

  const text = await ask(prompt)
  return parseJSON<ContentIdea[]>(text)
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

  const prompt = `
Write a "${sectionType}" section for the social media playbook of "${org.name}" (${org.industry}).

CONTEXT:
- Active platforms: ${org.activePlatforms.join(', ')}
- Goals: ${goals.map((g) => `${g.title}: target ${g.targetValue} ${g.unit}`).join(', ')}
- Brand voice: ${voice?.adjectives.join(', ') ?? 'professional, helpful'}
- Personas: ${personas.map((p) => p.name).join(', ')}
- Content pillars: ${pillars.map((p) => p.title).join(', ')}

Write 3-5 paragraphs of actionable, specific strategy content for this section. Return plain text (no JSON).`

  const text = await ask(prompt, 'You are a senior social media strategist writing a brand playbook. Be specific and actionable.')

  await prisma.playbookSection.upsert({
    where: { orgId_sectionType: { orgId, sectionType: sectionType as 'BRAND_VOICE' | 'STRATEGY' | 'POSTING_GUIDE' | 'OUTREACH' } },
    update: { content: { text } as object, generatedByAI: true },
    create: { orgId, sectionType: sectionType as 'BRAND_VOICE' | 'STRATEGY' | 'POSTING_GUIDE' | 'OUTREACH', content: { text } as object, generatedByAI: true },
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

  const prompt = `
Write a brief morning summary (3-5 sentences) for "${org.name}"'s social media team.

TODAY'S SCHEDULED POSTS: ${calendarToday.length > 0 ? calendarToday.map((p) => `${p.platform}: ${p.topic}`).join(', ') : 'None scheduled'}
PENDING TASKS: ${pendingChecklist.length} items (top: ${pendingChecklist[0]?.title ?? 'none'})
METRICS SNAPSHOT: ${metricsContext.map((m) => `${m.platform}: ${m.followers} followers (${m.followersDelta >= 0 ? '+' : ''}${m.followersDelta} today)`).join(', ')}
COMPETITOR ALERTS: ${competitorContext.length > 0 ? competitorContext.map((c) => `${c.handle} gained ${c.followersDelta} followers`).join(', ') : 'No significant changes'}

Write a motivating, actionable brief. Return plain text only.`

  const summary = await ask(prompt, 'You are a social media manager writing a daily team brief. Be concise, motivating, and specific.')

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

  const prompt = `
Create a detailed audience persona for "${org.name}" (${org.industry}).
Demographics hint: age ${demographics.ageRange ?? 'any'}, gender ${demographics.gender ?? 'any'}, location ${demographics.location ?? 'any'}.

Return JSON:
{"name": "Sarah M.", "ageRange": "28-35", "gender": "Female", "location": "Dubai, UAE", "interests": ["health", "family"], "painPoints": ["no time to research"], "contentPreference": "Short videos and infographics", "platforms": ["INSTAGRAM", "FACEBOOK"]}

Return ONLY the JSON.`

  const text = await ask(prompt)
  return parseJSON<GeneratedPersona>(text)
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

  const prompt = `
Generate a brand voice profile for "${org.name}" (${org.industry}).
Target audience: ${personas.map((p) => `${p.name}, ${p.ageRange}`).join('; ')}
Active platforms: ${org.activePlatforms.join(', ')}

Return JSON:
{"adjectives": ["Warm","Expert","Local","Trustworthy","Clear"], "personality": "The Helpful Expert", "dos": ["Use simple language"], "donts": ["Use jargon"], "toneByPlatform": {"INSTAGRAM": "casual and visual", "FACEBOOK": "informative and community-focused"}, "captionGood": "example good caption here", "captionBad": "example bad caption here"}

Return ONLY the JSON.`

  const text = await ask(prompt)
  return parseJSON<GeneratedBrandVoice>(text)
}
