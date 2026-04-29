/**
 * SEOIntelligenceService — Keyword discovery, rank tracking, presence scoring
 *
 * Runs on org creation (keyword discovery) and weekly (rank refresh).
 * Never called directly from user requests — BullMQ only.
 */

import { prisma } from '../../lib/prisma'
import { aiService } from '../ai/aiService'
import {
  searchOrganicResults,
  checkKeywordRank,
  getCompetitorKeywords,
} from '../../lib/serpapi'
import { KeywordCategory } from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────

interface KeywordCandidate {
  keyword: string
  searchVolume: number
  difficulty: number
  competitorDomain: string | null
  competitorRank: number | null
  category: KeywordCategory
}

interface PresenceScoreBreakdown {
  socialFollowers: number    // 0-25
  socialEngagement: number   // 0-25
  seoKeywords: number        // 0-25
  googleProfile: number      // 0-15
  contentFreshness: number   // 0-10
  total: number              // 0-100
}

// ── Keyword Discovery ─────────────────────────────────────────

export async function discoverKeywords(orgId: string): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      industry: true,
      city: true,
      country: true,
      website: true,
      competitors: {
        where: { status: 'CONFIRMED' },
        select: { website: true, handle: true },
        take: 5,
      },
    },
  })

  console.log(`[SEO] Starting keyword discovery for org: ${org.name}`)

  const candidates: KeywordCandidate[] = []

  // Step 1: Build seed keywords
  const seedKeywords = buildSeedKeywords(org.industry, org.city ?? '')

  // Step 2: Check which seed keywords competitors rank for
  for (const kw of seedKeywords.slice(0, 10)) {
    const results = await searchOrganicResults(kw, 10)
    for (const result of results) {
      const domain = result.domain
      candidates.push({
        keyword: kw,
        searchVolume: estimateVolume(kw),
        difficulty: estimateDifficulty(result.position),
        competitorDomain: domain,
        competitorRank: result.position,
        category: categorizeKeyword(kw, result.position),
      })
    }
  }

  // Step 3: Get keywords from confirmed competitor websites
  for (const competitor of org.competitors) {
    if (!competitor.website) continue
    const domain = extractDomain(competitor.website)
    if (!domain) continue

    const competitorKeywords = await getCompetitorKeywords(
      domain,
      org.industry,
      org.city ?? '',
      5,
    )

    for (const kw of competitorKeywords) {
      candidates.push({
        keyword: kw.keyword,
        searchVolume: estimateVolume(kw.keyword),
        difficulty: estimateDifficulty(kw.position),
        competitorDomain: domain,
        competitorRank: kw.position,
        category: categorizeKeyword(kw.keyword, kw.position),
      })
    }
  }

  // Step 4: Claude ranks and deduplicates top 30
  const rankedKeywords = await rankKeywordsWithAI(candidates, org.industry, org.city ?? '')

  // Step 5: Check current rank for org's own website (if provided)
  const ownDomain = org.website ? extractDomain(org.website) : null
  for (const kw of rankedKeywords) {
    let currentRank: number | null = null
    if (ownDomain) {
      const rankResult = await checkKeywordRank(kw.keyword, ownDomain)
      currentRank = rankResult.position
    }

    await prisma.keywordOpportunity.upsert({
      where: { orgId_keyword: { orgId, keyword: kw.keyword } },
      create: {
        orgId,
        keyword: kw.keyword,
        searchVolume: kw.searchVolume,
        difficulty: kw.difficulty,
        currentRank,
        competitorDomain: kw.competitorDomain,
        competitorRank: kw.competitorRank,
        category: kw.category,
        contentCreated: false,
      },
      update: {
        searchVolume: kw.searchVolume,
        difficulty: kw.difficulty,
        currentRank,
        competitorDomain: kw.competitorDomain,
        competitorRank: kw.competitorRank,
        category: kw.category,
      },
    })
  }

  console.log(`[SEO] Discovered ${rankedKeywords.length} keywords for org: ${org.name}`)
}

// ── Rank Tracking (weekly refresh) ───────────────────────────

export async function refreshKeywordRanks(orgId: string): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { id: true, name: true, website: true },
  })

  if (!org.website) {
    console.warn(`[SEO] No website for org ${org.name} — skipping rank refresh`)
    return
  }

  const domain = extractDomain(org.website)
  if (!domain) return

  const keywords = await prisma.keywordOpportunity.findMany({
    where: { orgId },
    orderBy: { updatedAt: 'asc' },
    take: 20, // refresh oldest 20 per week to stay within API limits
  })

  for (const kw of keywords) {
    const result = await checkKeywordRank(kw.keyword, domain)
    await prisma.keywordOpportunity.update({
      where: { id: kw.id },
      data: { currentRank: result.position, updatedAt: new Date() },
    })
  }
}

// ── Presence Score Calculation ────────────────────────────────

export async function calculatePresenceScore(orgId: string): Promise<number> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      socialAccounts: {
        include: {
          metrics: {
            orderBy: { snapshotDate: 'desc' },
            take: 1,
          },
        },
      },
      keywordOpportunities: true,
      orgIntelligence: true,
    },
  })

  const breakdown: PresenceScoreBreakdown = {
    socialFollowers: 0,
    socialEngagement: 0,
    seoKeywords: 0,
    googleProfile: 0,
    contentFreshness: 0,
    total: 0,
  }

  // Social followers score (0-25)
  const totalFollowers = org.socialAccounts.reduce((sum, acc) => {
    const latest = acc.metrics[0]
    return sum + (latest?.followers ?? 0)
  }, 0)
  breakdown.socialFollowers = Math.min(25, Math.floor((totalFollowers / 10000) * 25))

  // Social engagement score (0-25)
  const avgEngagement =
    org.socialAccounts.reduce((sum, acc) => {
      const latest = acc.metrics[0]
      return sum + (latest?.engagementRate ?? 0)
    }, 0) / Math.max(1, org.socialAccounts.length)
  breakdown.socialEngagement = Math.min(25, Math.floor(avgEngagement * 5))

  // SEO keywords score (0-25)
  const rankingKeywords = org.keywordOpportunities.filter(
    (k) => k.currentRank !== null && k.currentRank <= 10,
  ).length
  breakdown.seoKeywords = Math.min(25, rankingKeywords * 5)

  // Google profile score (0-15) — from org intelligence
  if (org.orgIntelligence?.googlePlacesData) {
    const placesData = org.orgIntelligence.googlePlacesData as {
      rating?: number
      userRatingsTotal?: number
    }
    if (placesData.rating && placesData.userRatingsTotal) {
      breakdown.googleProfile = Math.min(15, Math.floor((placesData.rating / 5) * 15))
    }
  }

  // Content freshness score (0-10) — based on most recent post
  const mostRecentPost = org.socialAccounts.reduce(
    (latest, acc) => {
      const m = acc.metrics[0]
      if (!m) return latest
      return m.snapshotDate > (latest?.snapshotDate ?? new Date(0)) ? m : latest
    },
    null as { snapshotDate: Date } | null,
  )

  if (mostRecentPost) {
    const daysSincePost = Math.floor(
      (Date.now() - mostRecentPost.snapshotDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    breakdown.contentFreshness = daysSincePost <= 7 ? 10 : daysSincePost <= 30 ? 5 : 0
  }

  breakdown.total =
    breakdown.socialFollowers +
    breakdown.socialEngagement +
    breakdown.seoKeywords +
    breakdown.googleProfile +
    breakdown.contentFreshness

  // Update org intelligence with new score
  await prisma.orgIntelligence.upsert({
    where: { orgId },
    create: {
      orgId,
      presenceScore: breakdown.total,
      presenceScoreBreakdown: breakdown,
      lastScannedAt: new Date(),
    },
    update: {
      presenceScore: breakdown.total,
      presenceScoreBreakdown: breakdown,
      lastScannedAt: new Date(),
    },
  })

  return breakdown.total
}

// ── Helpers ───────────────────────────────────────────────────

function buildSeedKeywords(industry: string, city: string): string[] {
  const base = industry.toLowerCase()
  const loc = city.toLowerCase()
  return [
    `${base} in ${loc}`,
    `best ${base} in ${loc}`,
    `${base} near me`,
    `top ${base} ${loc}`,
    `${base} services ${loc}`,
    `${base} clinic ${loc}`,
    `affordable ${base} ${loc}`,
    `${base} specialist ${loc}`,
    `${base} center ${loc}`,
    `${base} ${loc} contact`,
  ]
}

function estimateVolume(keyword: string): number {
  // Simple heuristic — local + near me keywords tend to have lower but focused volume
  if (keyword.includes('near me')) return 1000
  if (keyword.includes('best')) return 500
  if (keyword.includes('top')) return 300
  return 200
}

function estimateDifficulty(position: number | null): number {
  if (!position) return 70
  if (position <= 3) return 80
  if (position <= 10) return 60
  if (position <= 30) return 40
  return 25
}

function categorizeKeyword(keyword: string, competitorRank: number | null): KeywordCategory {
  if (keyword.includes('near me') || keyword.includes(' in ')) {
    return KeywordCategory.LOCAL
  }
  if (!competitorRank || competitorRank > 20) {
    return KeywordCategory.QUICK_WIN
  }
  if (competitorRank <= 10) {
    return KeywordCategory.LONG_TERM
  }
  return KeywordCategory.MEDIUM
}

function extractDomain(website: string): string | null {
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    return url.hostname.replace('www.', '')
  } catch {
    return null
  }
}

async function rankKeywordsWithAI(
  candidates: KeywordCandidate[],
  industry: string,
  city: string,
): Promise<KeywordCandidate[]> {
  if (candidates.length === 0) return []

  // Deduplicate first
  const seen = new Set<string>()
  const unique = candidates.filter((c) => {
    if (seen.has(c.keyword)) return false
    seen.add(c.keyword)
    return true
  })

  if (unique.length <= 30) return unique

  try {
    const prompt = `Select the 30 most valuable keywords for an ${industry} business in ${city}.

Keywords (${unique.length} total):
${unique.map((k, i) => `${i + 1}. "${k.keyword}" | Volume: ~${k.searchVolume} | Difficulty: ${k.difficulty} | Competitor rank: ${k.competitorRank ?? 'not ranking'}`).join('\n')}

Return only a JSON array of indices (1-based) of the 30 best keywords, ordered by priority.
Prioritize: local intent, lower difficulty, higher volume, and competitor vulnerability.
Format: [1, 5, 3, ...] — JSON array only.`

    const response = await aiService.complete(prompt, 500)
    const match = response.match(/\[[\d,\s]+\]/)
    if (!match) return unique.slice(0, 30)

    const indices = JSON.parse(match[0]) as number[]
    return indices
      .filter((i) => i > 0 && i <= unique.length)
      .slice(0, 30)
      .map((i) => unique[i - 1]!)
  } catch {
    return unique.slice(0, 30)
  }
}
