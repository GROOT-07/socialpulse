import { prisma } from '../../lib/prisma'
import { askJSON, ask } from '../../lib/ai/gemini'

interface PlatformBrief {
  hook: string
  points: string[]
  caption: string
  hashtags: string[]
}

interface SprintWeekData {
  weekNumber: number
  theme: string
  whyNow: string
  notableDates: string[]
  platforms: Record<string, PlatformBrief>
}

export async function generateSprintPlan(orgId: string, startDate: Date): Promise<string> {
  // Fetch org context
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      contentPillars: true,
      personas: true,
    },
  })

  // Fetch special days for the 8-week window
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 56) // 8 weeks

  const specialDays = await prisma.specialDay.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      OR: [
        { countries: { hasSome: [org.country ?? 'IN', 'GLOBAL'] } },
        { countries: { isEmpty: true } },
      ],
    },
    orderBy: { date: 'asc' },
    take: 40,
  })

  const trendingTopics = await prisma.trendingTopic.findMany({
    where: { orgId },
    orderBy: { volumeScore: 'desc' },
    take: 10,
  })

  const pillars = org.contentPillars.map((p) => p.title).join(', ')
  const platforms = (org.activePlatforms ?? []).slice(0, 4).join(', ')
  const specialDaySummary = specialDays
    .map((d) => `${d.name} on ${d.date.toISOString().split('T')[0]}`)
    .join('; ')
  const trendSummary = trendingTopics.map((t) => t.topic).join(', ')

  const prompt = `You are a social media content strategist for ${org.industry} businesses.

Generate an 8-week sprint content plan for: ${org.name}
Industry: ${org.industry}
Location: ${org.city ?? ''}, ${org.country ?? 'India'}
Active platforms: ${platforms || 'Instagram, Facebook'}
Content pillars: ${pillars || 'Awareness, Education, Engagement, Promotion'}
Upcoming special days: ${specialDaySummary || 'None'}
Trending topics: ${trendSummary || 'General industry trends'}

Return a JSON array of exactly 8 objects with this structure:
[
  {
    "weekNumber": 1,
    "theme": "string — catchy week theme",
    "whyNow": "string — 1-2 sentences explaining why this theme is timely",
    "notableDates": ["date string if any notable day this week"],
    "platforms": {
      "INSTAGRAM": {
        "hook": "attention-grabbing opening line",
        "points": ["point 1", "point 2", "point 3", "point 4"],
        "caption": "full ready-to-post caption (200 chars max)",
        "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
      },
      "FACEBOOK": { ... same structure ... }
    }
  },
  ...
]

Only include platform keys for: ${platforms || 'INSTAGRAM, FACEBOOK'}
Make all content specific to ${org.industry} industry in ${org.city ?? 'India'}.`

  const weeks = await askJSON<SprintWeekData[]>(prompt, {
    model: 'pro',
    maxTokens: 8192,
    temperature: 0.7,
  })

  // Create sprint plan in DB
  const endDateFinal = new Date(startDate)
  endDateFinal.setDate(endDateFinal.getDate() + 55)

  const sprint = await prisma.sprintPlan.create({
    data: {
      orgId,
      startDate,
      endDate: endDateFinal,
      status: 'GENERATING',
    },
  })

  // Create all 8 weeks
  await prisma.sprintWeek.createMany({
    data: weeks.map((w) => ({
      sprintId: sprint.id,
      weekNumber: w.weekNumber,
      theme: w.theme,
      whyNow: w.whyNow,
      notableDates: w.notableDates,
      platforms: w.platforms as object,
    })),
  })

  // Mark ready
  await prisma.sprintPlan.update({
    where: { id: sprint.id },
    data: { status: 'READY' },
  })

  return sprint.id
}

export async function regenerateSprintWeek(
  orgId: string,
  sprintId: string,
  weekNumber: number,
): Promise<string> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
  const week = await prisma.sprintWeek.findFirstOrThrow({
    where: { sprintId, weekNumber },
  })

  const platforms = (org.activePlatforms ?? ['INSTAGRAM', 'FACEBOOK']).slice(0, 4).join(', ')

  const prompt = `You are a social media content strategist for ${org.industry} businesses.

Regenerate alternative content ideas for Week ${weekNumber} of a social media sprint.
Current theme: "${week.theme}"
Organization: ${org.name} — ${org.industry} in ${org.city ?? 'India'}
Active platforms: ${platforms}

Generate fresh, different content ideas (not the same as the current theme).
Return JSON with this structure:
{
  "theme": "new theme",
  "whyNow": "why this theme works now",
  "notableDates": [],
  "platforms": {
    "INSTAGRAM": {
      "hook": "...",
      "points": ["...", "...", "...", "..."],
      "caption": "...",
      "hashtags": ["...", "...", "...", "...", "..."]
    }
  }
}`

  const result = await ask(prompt, { model: 'pro', maxTokens: 2048, temperature: 0.8 })
  return result
}

export async function getLatestSprint(orgId: string) {
  return prisma.sprintPlan.findFirst({
    where: { orgId, status: 'READY' },
    orderBy: { createdAt: 'desc' },
    include: {
      weeks: { orderBy: { weekNumber: 'asc' } },
    },
  })
}

export async function listSprints(orgId: string) {
  return prisma.sprintPlan.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    include: {
      weeks: { orderBy: { weekNumber: 'asc' } },
    },
    take: 5,
  })
}

export async function generateGuardrails(orgId: string): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: { voiceProfile: true },
  })

  const voice = org.voiceProfile

  const prompt = `You are a content compliance expert for ${org.industry} businesses in ${org.country ?? 'India'}.

Generate comprehensive content guardrails for: ${org.name}
Industry: ${org.industry}
${voice ? `Brand voice adjectives: ${voice.adjectives?.join(', ')}` : ''}

Return a JSON array of guardrail objects:
[
  {
    "category": "VOICE",
    "ruleType": "DO",
    "text": "...",
    "platform": null
  },
  ...
]

Categories: VOICE, LEGAL, PLATFORM, CONTENT, CULTURAL
Rule types: DO, DONT, RULE, WARNING
Platform: null (all), "INSTAGRAM", "FACEBOOK", "YOUTUBE", "WHATSAPP"

Generate at least 5 items per category. Make them specific to ${org.industry} in ${org.country ?? 'India'}.
For LEGAL: include industry-specific disclaimers and compliance rules.
For PLATFORM: include platform-specific formatting rules.
For CULTURAL: include cultural sensitivity guidelines for ${org.country ?? 'India'}.`

  interface GuardrailData {
    category: string
    ruleType: string
    text: string
    platform: string | null
  }

  const guardrails = await askJSON<GuardrailData[]>(prompt, {
    model: 'pro',
    maxTokens: 4096,
    temperature: 0.4,
  })

  // Delete old guardrails for this org
  await prisma.contentGuardrail.deleteMany({ where: { orgId } })

  // Insert new ones
  await prisma.contentGuardrail.createMany({
    data: guardrails.map((g) => ({
      orgId,
      category: g.category,
      ruleType: g.ruleType,
      text: g.text,
      platform: g.platform,
      aiGenerated: true,
    })),
  })
}
