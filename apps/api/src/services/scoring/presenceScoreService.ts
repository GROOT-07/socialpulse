/**
 * Presence Score Service
 *
 * Calculates an Online Presence Score (OPS) from 0-100 for an organization
 * based on social media presence, engagement, SEO, content freshness, and profile completeness.
 *
 * AI calls use ask from apps/api/src/lib/ai/gemini.ts
 */

import { prisma } from '../../lib/prisma'

export interface PresenceScore {
  total: number // 0-100
  breakdown: {
    socialFollowers: number    // 0-25
    engagementRate: number     // 0-25
    seoKeywords: number        // 0-25
    contentFreshness: number   // 0-15
    profileCompleteness: number // 0-10
  }
  lastCalculated: Date
}

export async function calculatePresenceScore(orgId: string): Promise<PresenceScore> {
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
    },
  })

  // 1. Social follower score (0-25): based on total followers across platforms
  const latestMetrics = org.socialAccounts.flatMap((a) => a.metrics)
  const totalFollowers = latestMetrics.reduce((sum, m) => sum + (m.followers ?? 0), 0)
  const followerScore = Math.min(25, Math.round((Math.log10(Math.max(totalFollowers, 1)) / 6) * 25))

  // 2. Engagement rate score (0-25): avg engagement across platforms
  const engagementRates = latestMetrics
    .map((m) => m.engagementRate ?? 0)
    .filter((r) => r > 0)
  const avgEngagement = engagementRates.length > 0
    ? engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length
    : 0
  const engagementScore = Math.min(25, Math.round((avgEngagement / 5) * 25)) // 5% = perfect

  // 3. SEO keyword score (0-25): keywords ranking in top 20
  const keywordCount = await prisma.keywordOpportunity.count({
    where: { orgId, currentRank: { lte: 20 } },
  })
  const seoScore = Math.min(25, Math.round((keywordCount / 10) * 25))

  // 4. Content freshness (0-15): based on last content piece date
  const lastContent = await prisma.contentCalendar.findFirst({
    where: { orgId, status: 'PUBLISHED' },
    orderBy: { date: 'desc' },
  })
  const daysSinceContent = lastContent
    ? Math.floor((Date.now() - lastContent.date.getTime()) / 86400000)
    : 30
  const freshnessScore = Math.min(15, Math.max(0, Math.round(15 - (daysSinceContent / 7) * 5)))

  // 5. Profile completeness (0-10)
  let completeness = 0
  if (org.name) completeness += 2
  if (org.industry) completeness += 2
  if (org.city) completeness += 2
  if (org.logoUrl) completeness += 2
  if ((org.activePlatforms ?? []).length > 0) completeness += 2
  const completenessScore = completeness

  const total = followerScore + engagementScore + seoScore + freshnessScore + completenessScore

  // Store in OrgIntelligence
  await prisma.orgIntelligence.upsert({
    where: { orgId },
    create: {
      orgId,
      presenceScore: total,
      lastScannedAt: new Date(),
    },
    update: {
      presenceScore: total,
    },
  })

  return {
    total,
    breakdown: {
      socialFollowers: followerScore,
      engagementRate: engagementScore,
      seoKeywords: seoScore,
      contentFreshness: freshnessScore,
      profileCompleteness: completenessScore,
    },
    lastCalculated: new Date(),
  }
}

export async function getPresenceScore(orgId: string): Promise<PresenceScore | null> {
  const intel = await prisma.orgIntelligence.findUnique({ where: { orgId } })
  if (!intel?.presenceScore) return null

  return {
    total: intel.presenceScore,
    breakdown: {
      socialFollowers: 0,
      engagementRate: 0,
      seoKeywords: 0,
      contentFreshness: 0,
      profileCompleteness: 0,
    },
    lastCalculated: intel.lastScannedAt ?? new Date(),
  }
}
