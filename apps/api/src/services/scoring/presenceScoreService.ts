/**
 * Online Presence Score (OPS) Service
 *
 * Calculates a weighted 0-100 score across 8 dimensions:
 *   20% SEO Authority          — keyword count, average difficulty, rankings
 *   20% Social Engagement      — engagement rates across platforms
 *   15% Brand Sentiment        — positive vs negative ratio from intelligence
 *   15% Search Visibility      — keywords with actual rankings
 *   10% Review Reputation      — from Google Places / crawled data
 *   10% Content Consistency    — calendar fill rate, posting frequency
 *    5% Website Quality        — scraped website meta quality
 *    5% Trend Participation     — trending topics being covered
 *
 * Stored back into OrgIntelligence.presenceScore + presenceScoreBreakdown
 */

import { prisma } from '../../lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import type { Prisma } from '@prisma/client'

const MODEL = 'claude-sonnet-4-20250514'

export interface OPSBreakdown {
  overall: number
  components: {
    seoAuthority:       { score: number; weight: number; label: string; detail: string }
    socialEngagement:   { score: number; weight: number; label: string; detail: string }
    brandSentiment:     { score: number; weight: number; label: string; detail: string }
    searchVisibility:   { score: number; weight: number; label: string; detail: string }
    reviewReputation:   { score: number; weight: number; label: string; detail: string }
    contentConsistency: { score: number; weight: number; label: string; detail: string }
    websiteQuality:     { score: number; weight: number; label: string; detail: string }
    trendParticipation: { score: number; weight: number; label: string; detail: string }
  }
  recommendations: string[]
  tier: 'Building' | 'Developing' | 'Established' | 'Authority'
  calculatedAt: string
}

// ── Component calculators ─────────────────────────────────────

async function calcSEOAuthority(orgId: string): Promise<{ score: number; detail: string }> {
  const kws = await prisma.keywordOpportunity.findMany({ where: { orgId } })
  if (kws.length === 0) return { score: 10, detail: 'No keywords tracked yet' }

  const ranked = kws.filter((k) => k.currentRank !== null && k.currentRank! <= 20)
  const avgDifficulty = kws.reduce((s, k) => s + k.difficulty, 0) / kws.length
  const rankingRatio = ranked.length / kws.length

  // Score: keyword count (up to 40pts) + ranking ratio (40pts) + difficulty balance (20pts)
  const countScore = Math.min(40, kws.length * 3)
  const rankScore = rankingRatio * 40
  const diffScore = Math.max(0, 20 - avgDifficulty / 5) // lower avg difficulty = easier wins
  const score = Math.round(countScore + rankScore + diffScore)

  return {
    score: Math.min(100, score),
    detail: `${kws.length} keywords tracked, ${ranked.length} ranking in top 20, avg difficulty ${Math.round(avgDifficulty)}`,
  }
}

async function calcSocialEngagement(orgId: string): Promise<{ score: number; detail: string }> {
  const accounts = await prisma.socialAccount.findMany({
    where: { orgId },
    include: { metrics: { orderBy: { snapshotDate: 'desc' }, take: 1 } },
  })

  if (accounts.length === 0) return { score: 5, detail: 'No social accounts connected' }

  const withMetrics = accounts.filter((a) => a.metrics.length > 0 && a.metrics[0]!.followers > 0)
  if (withMetrics.length === 0) return { score: 15, detail: 'Accounts connected but no metrics yet' }

  const avgEngagement = withMetrics.reduce((s, a) => s + a.metrics[0]!.engagementRate, 0) / withMetrics.length
  const avgFollowers = withMetrics.reduce((s, a) => s + a.metrics[0]!.followers, 0) / withMetrics.length

  // Engagement: 0-3% = poor, 3-6% = good, 6%+ = excellent
  const engScore = Math.min(60, avgEngagement * 10)
  // Followers: 1k=10pts, 10k=25pts, 100k=40pts
  const followerScore = Math.min(40, Math.log10(Math.max(1, avgFollowers)) * 10)
  const score = Math.round(engScore + followerScore)

  return {
    score: Math.min(100, score),
    detail: `${withMetrics.length} platforms, avg ${avgEngagement.toFixed(1)}% engagement, avg ${Math.round(avgFollowers / 1000)}K followers`,
  }
}

async function calcBrandSentiment(orgId: string): Promise<{ score: number; detail: string }> {
  const intel = await prisma.orgIntelligence.findUnique({ where: { orgId } })
  if (!intel) return { score: 40, detail: 'Run research to get sentiment score' }

  const strengths = intel.strengths?.length ?? 0
  const issues = (intel.urgentIssues as Array<{ issue: string }> | null)?.length ?? 0
  const total = strengths + issues
  if (total === 0) return { score: 50, detail: 'Neutral — no signals detected' }

  const ratio = strengths / total
  const score = Math.round(30 + ratio * 70)

  return {
    score,
    detail: `${strengths} positive signals, ${issues} urgent issues identified`,
  }
}

async function calcSearchVisibility(orgId: string): Promise<{ score: number; detail: string }> {
  const kws = await prisma.keywordOpportunity.findMany({ where: { orgId } })
  if (kws.length === 0) return { score: 5, detail: 'No keyword rankings tracked' }

  const top3  = kws.filter((k) => k.currentRank !== null && k.currentRank! <= 3).length
  const top10 = kws.filter((k) => k.currentRank !== null && k.currentRank! <= 10).length
  const top20 = kws.filter((k) => k.currentRank !== null && k.currentRank! <= 20).length

  const score = Math.min(100, top3 * 15 + top10 * 8 + top20 * 4 + (kws.length > 5 ? 10 : 0))

  return {
    score,
    detail: `${top3} in top 3, ${top10} in top 10, ${top20} in top 20`,
  }
}

async function calcReviewReputation(orgId: string): Promise<{ score: number; detail: string }> {
  const intel = await prisma.orgIntelligence.findUnique({ where: { orgId } })
  const places = intel?.googlePlacesData as { rating?: number; userRatingsTotal?: number } | null

  if (!places?.rating) return { score: 45, detail: 'Google Business profile not found' }

  const ratingScore = ((places.rating - 1) / 4) * 70   // 1-5 → 0-70
  const reviewCountScore = Math.min(30, Math.log10(Math.max(1, places.userRatingsTotal ?? 1)) * 10)
  const score = Math.round(ratingScore + reviewCountScore)

  return {
    score: Math.min(100, score),
    detail: `${places.rating}★ Google rating with ${places.userRatingsTotal ?? 0} reviews`,
  }
}

async function calcContentConsistency(orgId: string): Promise<{ score: number; detail: string }> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [calPosts, contentPieces] = await Promise.all([
    prisma.contentCalendar.count({ where: { orgId, date: { gte: thirtyDaysAgo } } }),
    prisma.contentPiece.count({ where: { orgId, createdAt: { gte: thirtyDaysAgo } } }),
  ])

  // Target: 20 posts/month = 100pts
  const postsScore = Math.min(70, calPosts * 3.5)
  const piecesScore = Math.min(30, contentPieces * 5)
  const score = Math.round(postsScore + piecesScore)

  return {
    score: Math.min(100, score),
    detail: `${calPosts} calendar posts and ${contentPieces} content pieces in past 30 days`,
  }
}

async function calcWebsiteQuality(orgId: string): Promise<{ score: number; detail: string }> {
  const intel = await prisma.orgIntelligence.findUnique({ where: { orgId } })
  const meta = intel?.websiteMetaData as { title?: string; description?: string; hasStructuredData?: boolean } | null
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { website: true },
  })

  if (!org?.website) return { score: 20, detail: 'No website URL provided' }
  if (!meta) return { score: 35, detail: 'Website not yet crawled' }

  let score = 40 // base for having a website
  if (meta.title) score += 20
  if (meta.description) score += 20
  if (meta.hasStructuredData) score += 20

  return {
    score,
    detail: meta.title ? `Website found with title and meta description` : 'Website found but meta tags missing',
  }
}

async function calcTrendParticipation(orgId: string): Promise<{ score: number; detail: string }> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const topics = await prisma.trendingTopic.findMany({
    where: { orgId, fetchedAt: { gte: thirtyDaysAgo } },
    orderBy: { trendDelta: 'desc' },
    take: 20,
  })

  if (topics.length === 0) return { score: 10, detail: 'No trending topics tracked yet' }

  const highDelta = topics.filter((t) => t.trendDelta > 50).length
  const score = Math.min(100, topics.length * 4 + highDelta * 10)

  return {
    score,
    detail: `${topics.length} trending topics tracked, ${highDelta} with high growth`,
  }
}

// ── Recommendations ───────────────────────────────────────────

function generateRecommendations(breakdown: OPSBreakdown['components']): string[] {
  const recs: string[] = []
  const items = Object.values(breakdown).sort((a, b) => a.score - b.score)

  for (const item of items.slice(0, 4)) {
    if (item.score < 30) recs.push(`🔴 ${item.label}: ${item.detail} — this is your biggest opportunity.`)
    else if (item.score < 60) recs.push(`🟡 ${item.label}: ${item.detail} — improving this will boost your OPS significantly.`)
  }

  if (recs.length === 0) recs.push('✅ Strong presence across all dimensions. Focus on maintaining consistency and exploring new platforms.')

  return recs
}

// ── Main export ───────────────────────────────────────────────

export async function calculateOPS(orgId: string): Promise<OPSBreakdown> {
  const [seo, social, sentiment, visibility, reputation, content, website, trends] = await Promise.all([
    calcSEOAuthority(orgId),
    calcSocialEngagement(orgId),
    calcBrandSentiment(orgId),
    calcSearchVisibility(orgId),
    calcReviewReputation(orgId),
    calcContentConsistency(orgId),
    calcWebsiteQuality(orgId),
    calcTrendParticipation(orgId),
  ])

  const components: OPSBreakdown['components'] = {
    seoAuthority:       { score: seo.score,        weight: 20, label: 'SEO Authority',        detail: seo.detail },
    socialEngagement:   { score: social.score,      weight: 20, label: 'Social Engagement',    detail: social.detail },
    brandSentiment:     { score: sentiment.score,   weight: 15, label: 'Brand Sentiment',      detail: sentiment.detail },
    searchVisibility:   { score: visibility.score,  weight: 15, label: 'Search Visibility',    detail: visibility.detail },
    reviewReputation:   { score: reputation.score,  weight: 10, label: 'Review Reputation',    detail: reputation.detail },
    contentConsistency: { score: content.score,     weight: 10, label: 'Content Consistency',  detail: content.detail },
    websiteQuality:     { score: website.score,     weight: 5,  label: 'Website Quality',      detail: website.detail },
    trendParticipation: { score: trends.score,      weight: 5,  label: 'Trend Participation',  detail: trends.detail },
  }

  const overall = Math.round(
    Object.values(components).reduce((s, c) => s + c.score * c.weight / 100, 0),
  )

  const tier: OPSBreakdown['tier'] =
    overall >= 70 ? 'Authority'
    : overall >= 50 ? 'Established'
    : overall >= 30 ? 'Developing'
    : 'Building'

  const breakdown: OPSBreakdown = {
    overall,
    components,
    recommendations: generateRecommendations(components),
    tier,
    calculatedAt: new Date().toISOString(),
  }

  // Persist to DB
  await prisma.orgIntelligence.upsert({
    where: { orgId },
    update: {
      presenceScore: overall,
      presenceScoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      lastScannedAt: new Date(),
    },
    create: {
      orgId,
      presenceScore: overall,
      presenceScoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      detectedKeywords: [],
      strengths: [],
      lastScannedAt: new Date(),
    },
  })

  return breakdown
}

export async function getOPS(orgId: string): Promise<OPSBreakdown | null> {
  const intel = await prisma.orgIntelligence.findUnique({ where: { orgId } })
  if (!intel?.presenceScoreBreakdown) return null
  return intel.presenceScoreBreakdown as unknown as OPSBreakdown
}
