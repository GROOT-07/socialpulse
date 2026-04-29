/**
 * Calendar Generation Service
 *
 * Uses Claude AI to create a full N-day content calendar for an org,
 * based on their content pillars, brand voice, active platforms,
 * and upcoming special days.
 *
 * Called from:
 *  - POST /api/calendar/generate  (user-triggered regeneration)
 *  - OrgSummaryWorker after content strategy is complete (auto on onboarding)
 */

import { prisma } from '../../lib/prisma'
import { aiService } from '../ai/aiService'
import { Platform, ContentFormat, PostStatus, Prisma } from '@prisma/client'

// Optimal posting times per platform (local 24h)
const DEFAULT_TIMES: Record<string, string[]> = {
  INSTAGRAM: ['09:00', '13:00', '18:00', '20:00'],
  FACEBOOK:  ['10:00', '14:00', '19:00'],
  YOUTUBE:   ['15:00', '18:00'],
  WHATSAPP:  ['09:00', '17:00'],
  GOOGLE:    ['10:00'],
}

// Posts per week per platform (Instagram gets more, YouTube gets fewer)
const POSTS_PER_WEEK: Record<string, number> = {
  INSTAGRAM: 5,
  FACEBOOK:  4,
  YOUTUBE:   2,
  WHATSAPP:  3,
  GOOGLE:    2,
}

const VALID_PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE'] as const
const VALID_FORMATS = ['POST', 'REEL', 'CAROUSEL', 'STORY', 'SHORT', 'VIDEO'] as const

interface AICalendarEntry {
  date: string
  platform: string
  topic: string
  contentPillar: string
  format: string
  caption: string
  hashtags?: string[]
  time?: string
}

// ── Main export ───────────────────────────────────────────────

export async function generateCalendarForOrg(
  orgId: string,
  daysAhead = 30,
  clearExisting = true,
): Promise<number> {
  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(startDate.getTime() + daysAhead * 86_400_000)

  const [org, pillars, brandVoice, specialDays] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        name: true,
        industry: true,
        city: true,
        activePlatforms: true,
        language: true,
      },
    }),
    prisma.contentPillar.findMany({ where: { orgId }, take: 6 }),
    prisma.brandVoice.findUnique({ where: { orgId } }),
    prisma.specialDay.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
      take: 20,
    }),
  ])

  // Only generate for platforms we support scraping
  const platforms = org.activePlatforms.filter((p): p is typeof VALID_PLATFORMS[number] =>
    (VALID_PLATFORMS as readonly string[]).includes(p),
  )
  if (platforms.length === 0) {
    console.warn(`[calendar-gen] No valid platforms for org ${orgId}`)
    return 0
  }

  // Build concise prompt
  const pillarsText =
    pillars.length > 0
      ? pillars.map((p) => `• ${p.title}: ${p.description ?? ''}`.trim()).join('\n')
      : `• Educational content\n• Behind the scenes\n• Customer stories\n• Promotional`

  const voiceText = brandVoice
    ? `Personality: ${brandVoice.personality ?? 'helpful'}. Tone: ${(brandVoice.adjectives ?? []).slice(0, 4).join(', ')}.`
    : 'Professional and friendly.'

  const specialDaysText =
    specialDays.length > 0
      ? specialDays
          .map((d) => `  ${d.date.toISOString().split('T')[0]} — ${d.name}`)
          .join('\n')
      : '  None'

  const platformInstructions = platforms
    .map((p) => {
      const perWeek = POSTS_PER_WEEK[p] ?? 3
      const formats =
        p === 'INSTAGRAM'
          ? 'REEL (40%), CAROUSEL (30%), POST (20%), STORY (10%)'
          : p === 'YOUTUBE'
            ? 'VIDEO (70%), SHORT (30%)'
            : 'POST (60%), CAROUSEL (40%)'
      return `${p}: ${perWeek} posts/week — formats: ${formats}`
    })
    .join('\n')

  const prompt = `You are an expert social media strategist. Create a ${daysAhead}-day content calendar.

BUSINESS
Name: ${org.name}
Industry: ${org.industry}
Location: ${org.city ?? 'India'}
Language: ${org.language ?? 'English'}

PLATFORMS & FREQUENCY
${platformInstructions}

CONTENT PILLARS
${pillarsText}

BRAND VOICE
${voiceText}

UPCOMING SPECIAL DAYS (use these for timely posts)
${specialDaysText}

INSTRUCTIONS
- Start date: ${startDate.toISOString().split('T')[0]}
- Generate entries for exactly ${daysAhead} days
- Match posting frequency above (not every platform every day)
- Vary formats — don't repeat the same format 3 days in a row
- On special days, create a platform-relevant post about that occasion
- Captions should be 1-2 sentences + 3-5 relevant hashtags
- Topics must be specific and actionable, not generic

Return a JSON array ONLY (no markdown, no explanation):
[
  {
    "date": "YYYY-MM-DD",
    "platform": "INSTAGRAM",
    "topic": "Specific, engaging topic",
    "contentPillar": "exact pillar title from above",
    "format": "REEL",
    "caption": "Engaging caption text with hashtags",
    "time": "09:00"
  }
]`

  const response = await aiService.complete(prompt, 4096)

  // Extract JSON array — handle markdown fences or raw JSON
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ?? response.match(/(\[[\s\S]*\])/)
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : response.trim()

  let entries: AICalendarEntry[]
  try {
    entries = JSON.parse(jsonStr) as AICalendarEntry[]
  } catch {
    throw new Error(`[calendar-gen] AI returned invalid JSON: ${jsonStr.slice(0, 200)}`)
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('[calendar-gen] AI returned empty calendar')
  }

  // Clear existing planned posts in the window
  if (clearExisting) {
    await prisma.contentCalendar.deleteMany({
      where: {
        orgId,
        status: PostStatus.PLANNED,
        date: { gte: startDate, lte: endDate },
      },
    })
  }

  // Validate and shape entries
  const rows = entries
    .filter((e) => {
      const d = new Date(e.date)
      return !isNaN(d.getTime()) && d >= startDate && d <= endDate &&
        (VALID_PLATFORMS as readonly string[]).includes(e.platform)
    })
    .map((e) => {
      const platform = e.platform as Platform
      const format = (VALID_FORMATS as readonly string[]).includes(e.format)
        ? (e.format as ContentFormat)
        : ContentFormat.POST

      // Pick a sensible posting time
      const times = DEFAULT_TIMES[platform] ?? ['10:00']
      const time = e.time ?? times[Math.floor(Math.random() * times.length)] ?? '10:00'

      // Merge hashtags into caption if they came separately
      const hashtags = Array.isArray(e.hashtags)
        ? (e.hashtags as string[]).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
        : ''
      const caption = [e.caption ?? '', hashtags].filter(Boolean).join('\n')

      return {
        orgId,
        date: new Date(e.date),
        time,
        platform,
        topic: (e.topic ?? 'Content post').slice(0, 200),
        contentPillar: e.contentPillar ?? undefined,
        format,
        caption: caption.slice(0, 2200),
        status: PostStatus.PLANNED,
      } satisfies Prisma.ContentCalendarCreateManyInput
    })

  if (rows.length === 0) {
    throw new Error('[calendar-gen] No valid entries after filtering')
  }

  await prisma.contentCalendar.createMany({ data: rows, skipDuplicates: true })

  console.info(
    `[calendar-gen] Created ${rows.length} posts for org ${orgId} (${daysAhead} day window)`,
  )
  return rows.length
}
