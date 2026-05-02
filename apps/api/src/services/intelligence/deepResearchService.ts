/**
 * Deep Research Service
 *
 * Uses Gemini AI to comprehensively research any organisation.
 * No Apify / OAuth / external API keys required beyond GEMINI_API_KEY.
 *
 * Generates and persists:
 *  • OrgIntelligence  — presence score, strengths, issues, quick wins
 *  • Competitors       — 6-8 real competitors with estimated metrics
 *  • KeywordOpportunity — 10-15 SEO keywords
 *  • SocialMetrics     — AI-estimated baseline metrics (only if none exist)
 *
 * Called from:
 *  • GET  /api/orgs/:id/intelligence  (auto-runs when no data or stale >24 h)
 *  • POST /api/orgs/:id/research      (force fresh scan)
 *  • GET  /api/competitors            (auto-runs when empty)
 */

import { askJSON } from '../../lib/ai/gemini'
import { prisma } from '../../lib/prisma'
import {
  Platform,
  CompetitorStatus,
  CompetitorSource,
  KeywordCategory,
  type Prisma as PrismaTypes,
} from '@prisma/client'

const STALE_HOURS = 24

// ── Types returned by Claude ──────────────────────────────────

interface CompetitorEntry {
  businessName: string
  handle: string
  platform: string
  profileUrl: string
  estimatedFollowers: number
  estimatedEngagement: number
  relevanceScore: number
  discoveryReason: string
  website?: string
}

interface KeywordEntry {
  keyword: string
  searchVolume: number
  difficulty: number
  category: string
}

interface PlatformEstimate {
  platform: string
  followers: number
  engagementRate: number
  posts: number
  avgLikes: number
  avgComments: number
}

interface ResearchResult {
  description: string
  presenceScore: number
  strengths: string[]
  urgentIssues: Array<{ issue: string; actionLink: string }>
  quickWins: Array<{ action: string; impact: string }>
  detectedKeywords: string[]
  competitors: CompetitorEntry[]
  seoKeywords: KeywordEntry[]
  platformEstimates: PlatformEstimate[]
  industryBenchmarks: {
    avgFollowers: number
    avgEngagementRate: number
    top10pctFollowers: number
  }
}

// ── Staleness check ───────────────────────────────────────────

export async function isResearchStale(orgId: string): Promise<boolean> {
  const intel = await prisma.orgIntelligence.findUnique({
    where: { orgId },
    select: { lastScannedAt: true },
  })
  if (!intel?.lastScannedAt) return true
  const ageMs = Date.now() - intel.lastScannedAt.getTime()
  return ageMs > STALE_HOURS * 3_600_000
}

// ── Main export ───────────────────────────────────────────────

export async function deepResearchOrg(orgId: string): Promise<void> {
  // Load org with social accounts and pillars
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      socialAccounts: true,
      contentPillars: { take: 5 },
    },
  })

  const socialProfiles = org.socialAccounts
    .map((a) => `${a.platform}: ${a.profileUrl ?? a.handle ?? 'not specified'}`)
    .join(' | ')

  const platformList = org.activePlatforms.length > 0
    ? org.activePlatforms.join(', ')
    : 'INSTAGRAM, FACEBOOK'

  const prompt = `You are a senior social media intelligence analyst specialising in Indian businesses.

Research "${org.name}" — a ${org.industry} business${org.city ? ` based in ${org.city}, India` : ' in India'}.

KNOWN PROFILE:
• Industry: ${org.industry}
• City: ${org.city ?? 'India'}
• Active platforms: ${platformList}
• Social profiles: ${socialProfiles || 'not specified'}
• Website: ${(org as { website?: string }).website ?? 'unknown'}

Using your knowledge of the ${org.industry} industry in India, produce a comprehensive intelligence report.

Return a single JSON object with this EXACT structure (no markdown, no explanation):
{
  "description": "2–3 sentence realistic business description based on this type of ${org.industry} business in ${org.city ?? 'India'}",
  "presenceScore": 38,
  "strengths": [
    "Specific strength based on industry/location context",
    "Another realistic strength",
    "Third strength"
  ],
  "urgentIssues": [
    {"issue": "Most critical gap holding them back (specific)", "actionLink": "/settings"},
    {"issue": "Second urgent issue", "actionLink": "/studio/calendar"},
    {"issue": "Third issue", "actionLink": "/competitors"}
  ],
  "quickWins": [
    {"action": "Specific action they can take this week", "impact": "Measurable outcome within 30 days"},
    {"action": "Second quick win", "impact": "Expected result"},
    {"action": "Third quick win", "impact": "Expected result"}
  ],
  "detectedKeywords": ["primary keyword", "secondary keyword", "local keyword", "service keyword", "brand keyword"],
  "competitors": [
    {
      "businessName": "Real competitor business name",
      "handle": "their_instagram_handle",
      "platform": "INSTAGRAM",
      "profileUrl": "https://www.instagram.com/their_handle/",
      "estimatedFollowers": 18500,
      "estimatedEngagement": 3.4,
      "relevanceScore": 90,
      "discoveryReason": "Direct ${org.industry} competitor in ${org.city ?? 'same region'} with similar offerings",
      "website": "https://their-website.com"
    }
  ],
  "seoKeywords": [
    {"keyword": "${org.industry.toLowerCase()} in ${org.city ?? 'india'}", "searchVolume": 2900, "difficulty": 42, "category": "LOCAL"},
    {"keyword": "best ${org.industry.toLowerCase()} ${org.city ?? 'india'}", "searchVolume": 1600, "difficulty": 38, "category": "LOCAL"},
    {"keyword": "affordable ${org.industry.toLowerCase()} services", "searchVolume": 880, "difficulty": 35, "category": "QUICK_WIN"},
    {"keyword": "${org.industry.toLowerCase()} near me", "searchVolume": 4400, "difficulty": 55, "category": "LOCAL"},
    {"keyword": "top ${org.industry.toLowerCase()} ${org.city ?? 'india'}", "searchVolume": 720, "difficulty": 40, "category": "QUICK_WIN"}
  ],
  "platformEstimates": [
    {"platform": "INSTAGRAM", "followers": 2800, "engagementRate": 3.8, "posts": 134, "avgLikes": 106, "avgComments": 9},
    {"platform": "FACEBOOK", "followers": 3400, "engagementRate": 1.7, "posts": 287, "avgLikes": 58, "avgComments": 14},
    {"platform": "YOUTUBE", "followers": 820, "engagementRate": 4.2, "posts": 38, "avgLikes": 34, "avgComments": 6}
  ],
  "industryBenchmarks": {
    "avgFollowers": 9200,
    "avgEngagementRate": 3.1,
    "top10pctFollowers": 52000
  }
}

RULES:
• presenceScore: 0–100. Typical small local business = 20–45. Mid-size regional brand = 45–65. National brand = 65–85.
• competitors: EXACTLY 6 real, named competitors in the ${org.industry} space${org.city ? ` in or near ${org.city}` : ' in India'}. Use your actual knowledge of real businesses. Different platforms for variety (mix INSTAGRAM, FACEBOOK, YOUTUBE).
• estimatedFollowers: realistic for their city/size. A local ${org.city ?? 'Indian'} ${org.industry} page usually has 2 000–50 000 followers.
• seoKeywords: EXACTLY 10 keywords. Mix of LOCAL, QUICK_WIN, MEDIUM, LONG_TERM categories.
• platformEstimates: only include platforms from [${platformList}].
• All numbers must be realistic integers. No made-up huge numbers.
• Return ONLY valid JSON — no markdown fences, no extra text.`

  const data = await askJSON<ResearchResult>(prompt, {
    model: 'pro',
    maxTokens: 4096,
    systemPrompt: 'You are a social media intelligence analyst with deep knowledge of Indian businesses, industries, and social media benchmarks. Always return valid JSON with realistic, specific data.',
  })

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // ── 1. Upsert OrgIntelligence ───────────────────────────────

  await prisma.orgIntelligence.upsert({
    where: { orgId },
    create: {
      orgId,
      detectedKeywords: data.detectedKeywords ?? [],
      strengths: data.strengths ?? [],
      urgentIssues: (data.urgentIssues ?? []) as unknown as PrismaTypes.InputJsonValue,
      quickWins: (data.quickWins ?? []) as unknown as PrismaTypes.InputJsonValue,
      aiDiagnosis: {
        description: data.description,
        benchmarks: data.industryBenchmarks,
        generatedBy: 'gemini-deep-research',
      } as unknown as PrismaTypes.InputJsonValue,
      presenceScore: Math.min(100, Math.max(0, data.presenceScore ?? 30)),
      lastScannedAt: new Date(),
    },
    update: {
      detectedKeywords: data.detectedKeywords ?? [],
      strengths: data.strengths ?? [],
      urgentIssues: (data.urgentIssues ?? []) as unknown as PrismaTypes.InputJsonValue,
      quickWins: (data.quickWins ?? []) as unknown as PrismaTypes.InputJsonValue,
      aiDiagnosis: {
        description: data.description,
        benchmarks: data.industryBenchmarks,
        generatedBy: 'gemini-deep-research',
      } as unknown as PrismaTypes.InputJsonValue,
      presenceScore: Math.min(100, Math.max(0, data.presenceScore ?? 30)),
      lastScannedAt: new Date(),
    },
  })

  // ── 2. Upsert Competitors + CompetitorMetrics ───────────────

  const VALID_PLATFORMS: Platform[] = [Platform.INSTAGRAM, Platform.FACEBOOK, Platform.YOUTUBE]

  for (const comp of data.competitors ?? []) {
    const platform = VALID_PLATFORMS.includes(comp.platform as Platform)
      ? (comp.platform as Platform)
      : Platform.INSTAGRAM

    const handle = (comp.handle ?? comp.businessName ?? 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, '')
      .slice(0, 80) || 'unknown'

    try {
      const saved = await prisma.competitor.upsert({
        where: { orgId_platform_handle: { orgId, platform, handle } },
        create: {
          orgId,
          platform,
          handle,
          businessName: comp.businessName?.slice(0, 120) ?? handle,
          profileUrl: comp.profileUrl?.slice(0, 500) ?? null,
          website: comp.website?.slice(0, 500) ?? null,
          relevanceScore: Math.min(100, Math.max(0, comp.relevanceScore ?? 60)),
          status: CompetitorStatus.CONFIRMED,
          source: CompetitorSource.SOCIAL_DISCOVERY,
          discoveryReason: (comp.discoveryReason ?? '').slice(0, 500),
        },
        update: {
          businessName: comp.businessName?.slice(0, 120) ?? handle,
          profileUrl: comp.profileUrl?.slice(0, 500) ?? null,
          relevanceScore: Math.min(100, Math.max(0, comp.relevanceScore ?? 60)),
          status: CompetitorStatus.CONFIRMED,
          discoveryReason: (comp.discoveryReason ?? '').slice(0, 500),
        },
      })

      const followers = Math.max(0, comp.estimatedFollowers ?? 0)
      const engRate = Math.min(20, Math.max(0, comp.estimatedEngagement ?? 0))

      await prisma.competitorMetrics.upsert({
        where: { competitorId_snapshotDate: { competitorId: saved.id, snapshotDate: today } },
        create: {
          competitorId: saved.id,
          snapshotDate: today,
          followers,
          engagementRate: engRate,
          avgLikes: Math.round((followers * engRate) / 100),
          avgComments: Math.round((followers * engRate) / 1000),
        },
        update: {
          followers,
          engagementRate: engRate,
          avgLikes: Math.round((followers * engRate) / 100),
          avgComments: Math.round((followers * engRate) / 1000),
        },
      })
    } catch (err) {
      console.warn(`[deepResearch] Skipped competitor "${comp.handle}": ${(err as Error).message}`)
    }
  }

  // ── 3. Upsert SEO keywords ──────────────────────────────────

  const VALID_KW_CATS = ['QUICK_WIN', 'MEDIUM', 'LONG_TERM', 'LOCAL'] as const
  type ValidKwCat = typeof VALID_KW_CATS[number]

  for (const kw of data.seoKeywords ?? []) {
    const category: KeywordCategory = VALID_KW_CATS.includes(kw.category as ValidKwCat)
      ? (kw.category as KeywordCategory)
      : KeywordCategory.MEDIUM

    try {
      await prisma.keywordOpportunity.upsert({
        where: { orgId_keyword: { orgId, keyword: kw.keyword } },
        create: {
          orgId,
          keyword: kw.keyword,
          searchVolume: Math.max(0, kw.searchVolume ?? 0),
          difficulty: Math.min(100, Math.max(0, kw.difficulty ?? 50)),
          category,
        },
        update: {
          searchVolume: Math.max(0, kw.searchVolume ?? 0),
          difficulty: Math.min(100, Math.max(0, kw.difficulty ?? 50)),
          category,
        },
      })
    } catch {
      // skip duplicate keyword
    }
  }

  // ── 4. Estimated social metrics (only if account has NO real data) ──

  for (const est of data.platformEstimates ?? []) {
    const platform = VALID_PLATFORMS.includes(est.platform as Platform)
      ? (est.platform as Platform)
      : null
    if (!platform) continue

    const account = org.socialAccounts.find((a) => a.platform === platform)
    if (!account) continue

    // Only skip if we have REAL metrics with actual follower counts (> 0).
    // A 0-follower metric record from a failed API call is treated as empty.
    const hasRealData = await prisma.socialMetrics.count({
      where: {
        socialAccountId: account.id,
        followers: { gt: 0 },
        rawJson: { not: { path: ['isEstimated'], equals: true } },
      },
    })
    if (hasRealData > 0) continue // preserve real non-zero data

    const followers = Math.max(0, est.followers ?? 0)
    const engRate = Math.min(20, Math.max(0, est.engagementRate ?? 0))

    await prisma.socialMetrics.upsert({
      where: { socialAccountId_snapshotDate: { socialAccountId: account.id, snapshotDate: today } },
      create: {
        socialAccountId: account.id,
        snapshotDate: today,
        followers,
        following: Math.round(followers * 0.55),
        posts: Math.max(0, est.posts ?? 0),
        engagementRate: engRate,
        reach: Math.round(followers * 0.18),
        impressions: Math.round(followers * 0.28),
        avgLikes: Math.max(0, est.avgLikes ?? 0),
        avgComments: Math.max(0, est.avgComments ?? 0),
        rawJson: {
          isEstimated: true,
          source: 'AI_DEEP_RESEARCH',
          generatedAt: new Date().toISOString(),
        } as unknown as PrismaTypes.InputJsonValue,
      },
      update: {
        // don't overwrite existing estimated data — leave stale is fine
      },
    })
  }

  console.info(`[deepResearch] ✓ org ${orgId} — score=${data.presenceScore}, competitors=${data.competitors?.length ?? 0}, keywords=${data.seoKeywords?.length ?? 0}`)
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                           