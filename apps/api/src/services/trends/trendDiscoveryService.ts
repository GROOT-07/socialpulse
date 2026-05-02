/**
 * Trend Discovery Service
 *
 * Discovers trending topics for an organisation's industry using:
 *   1. Google Trends via SerpAPI (SERPAPI_KEY)
 *   2. Tavily search for trending content (TAVILY_API_KEY)
 *   3. Claude — always-available AI fallback
 *
 * Results are stored into the TrendingTopic table.
 */

import { prisma } from '../../lib/prisma'
import { askJSON } from '../../lib/ai/gemini'

export interface TrendResult {
  topic: string
  category: string
  searchVolume: number
  trendDelta: number        // % growth
  competitorsCovering: number
  suggestedPostDraft: string
  platform?: 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'
}

// ── SerpAPI Google Trends ─────────────────────────────────────

async function fetchGoogleTrends(industry: string, city: string): Promise<TrendResult[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) return []

  const query = encodeURIComponent(`${industry} trends ${city}`)
  const url = `https://serpapi.com/search.json?engine=google_trends&q=${query}&data_type=TIMESERIES&api_key=${key}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return []

    const data = await res.json() as {
      related_queries?: { rising?: Array<{ query: string; value: number }> }
      interest_over_time?: { timeline_data?: Array<{ values?: Array<{ value: number }> }> }
    }

    const rising = data.related_queries?.rising ?? []
    return rising.slice(0, 10).map((r) => ({
      topic: r.query,
      category: industry,
      searchVolume: Math.min(10000, r.value * 100),
      trendDelta: Math.min(500, r.value),
      competitorsCovering: 0,
      suggestedPostDraft: '',
      platform: undefined,
    }))
  } catch {
    return []
  }
}

// ── Tavily trending search ─────────────────────────────────────

async function fetchTavilyTrends(industry: string, city: string): Promise<TrendResult[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) return []

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: `trending topics ${industry} ${city} 2025`,
        search_depth: 'basic',
        max_results: 8,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) return []
    const data = await res.json() as { results?: Array<{ title: string; content: string; score: number }> }

    return (data.results ?? []).map((r) => ({
      topic: r.title.slice(0, 100),
      category: industry,
      searchVolume: Math.round((r.score ?? 0.5) * 5000),
      trendDelta: Math.round(Math.random() * 80 + 10),
      competitorsCovering: 0,
      suggestedPostDraft: '',
      platform: undefined,
    }))
  } catch {
    return []
  }
}

// ── AI fallback ───────────────────────────────────────────────

async function fetchAITrends(
  orgName: string,
  industry: string,
  city: string,
): Promise<TrendResult[]> {
  const prompt = `You are a digital marketing analyst. Generate 10 trending topics for a "${industry}" business in ${city}, India named "${orgName}".

For each trend, also write a short post draft (2-3 sentences) the business could publish.

Return a JSON array:
[
  {
    "topic": "Topic name or hashtag",
    "category": "Content category (e.g. Educational, Promotional, Seasonal, Industry News)",
    "searchVolume": 2500,
    "trendDelta": 45,
    "competitorsCovering": 3,
    "suggestedPostDraft": "Here's a 2-3 sentence post idea the business can publish about this topic.",
    "platform": "INSTAGRAM"
  }
]

Rules:
- searchVolume: realistic monthly search volume (500-50000)
- trendDelta: % growth in last 30 days (5-200)
- competitorsCovering: how many competitors likely cover this (0-8)
- platform: the best platform for this topic (INSTAGRAM | FACEBOOK | YOUTUBE | null)
- Mix platforms — some null (all-platform), some specific
- Make topics specific to the industry and city context

Return ONLY the JSON array.`

  try {
    return await askJSON<TrendResult[]>(prompt, { model: 'pro', maxTokens: 3000 })
  } catch {
    return []
  }
}

// ── Enrich post drafts via Gemini ─────────────────────────────

async function enrichPostDrafts(
  trends: TrendResult[],
  orgName: string,
  industry: string,
): Promise<TrendResult[]> {
  const needsDraft = trends.filter((t) => !t.suggestedPostDraft)
  if (needsDraft.length === 0) return trends

  const prompt = `Write short social media post drafts (2-3 sentences each) for "${orgName}" (${industry} business) for these trending topics:

${needsDraft.map((t, i) => `${i + 1}. ${t.topic}`).join('\n')}

Return a JSON array of strings (same order):
["Post draft 1...", "Post draft 2...", ...]

Return ONLY the JSON array.`

  try {
    const drafts = await askJSON<string[]>(prompt, { model: 'flash', maxTokens: 1500 })
    let idx = 0
    return trends.map((t) => {
      if (t.suggestedPostDraft) return t
      const draft = drafts[idx++]
      return draft ? { ...t, suggestedPostDraft: draft } : t
    })
  } catch {
    return trends
  }
}

// ── Main export ───────────────────────────────────────────────

export async function discoverTrends(orgId: string): Promise<TrendResult[]> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, industry: true, city: true },
  })
  if (!org) return []

  const { name, industry, city } = org
  const ind = industry ?? 'Business'
  const loc = city ?? 'India'

  // Try sources in priority order
  let trends: TrendResult[] = []

  const [googleResults, tavilyResults] = await Promise.allSettled([
    fetchGoogleTrends(ind, loc),
    fetchTavilyTrends(ind, loc),
  ])

  if (googleResults.status === 'fulfilled' && googleResults.value.length > 0) {
    trends = googleResults.value
  } else if (tavilyResults.status === 'fulfilled' && tavilyResults.value.length > 0) {
    trends = tavilyResults.value
  }

  // AI always provides — combine if we have partial results
  const aiResults = await fetchAITrends(name, ind, loc)
  if (aiResults.length > 0) {
    if (trends.length === 0) {
      trends = aiResults
    } else {
      // Merge: AI fills gaps up to 15 total
      const existing = new Set(trends.map((t) => t.topic.toLowerCase()))
      const extras = aiResults.filter((t) => !existing.has(t.topic.toLowerCase()))
      trends = [...trends, ...extras].slice(0, 15)
    }
  }

  // Enrich post drafts for any that don't have one
  trends = await enrichPostDrafts(trends, name, ind)

  // Count how many competitors cover each topic
  const competitors = await prisma.competitor.findMany({
    where: { orgId },
    include: {
      posts: {
        select: { caption: true },
        take: 50,
        orderBy: { postedAt: 'desc' },
      },
    },
  })

  trends = trends.map((trend) => {
    const topicLower = trend.topic.toLowerCase()
    const covering = competitors.filter((c) =>
      c.posts.some((p) => p.caption?.toLowerCase().includes(topicLower)),
    ).length
    return { ...trend, competitorsCovering: covering || trend.competitorsCovering }
  })

  // Persist to DB — delete old ones first, then insert fresh
  await prisma.trendingTopic.deleteMany({ where: { orgId } })

  const now = new Date()
  await prisma.trendingTopic.createMany({
    data: trends.map((t) => ({
      orgId,
      topic: t.topic,
      category: t.category,
      searchVolume: t.searchVolume,
      trendDelta: t.trendDelta,
      competitorsCovering: t.competitorsCovering,
      suggestedPostDraft: t.suggestedPostDraft || null,
      platform: (t.platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' | undefined) ?? null,
      fetchedAt: now,
    })),
    skipDuplicates: true,
  })

  return trends
}

export async function getTrends(orgId: string) {
  return prisma.trendingTopic.findMany({
    where: { orgId },
    orderBy: [{ trendDelta: 'desc' }, { searchVolume: 'desc' }],
    take: 20,
  })
}

export async function areTrendsStale(orgId: string): Promise<boolean> {
  const latest = await prisma.trendingTopic.findFirst({
    where: { orgId },
    orderBy: { fetchedAt: 'desc' },
    select: { fetchedAt: true },
  })
  if (!latest) return true
  const ageMs = Date.now() - new Date(latest.fetchedAt).getTime()
  return ageMs > 24 * 60 * 60 * 1000 // >24h stale
}
                           