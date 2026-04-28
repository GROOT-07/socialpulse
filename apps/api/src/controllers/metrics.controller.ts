/**
 * Metrics controller
 * Reads aggregated + per-platform metrics from DB (never from social APIs directly).
 * All data was written by BullMQ workers via socialDataService.
 */

import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

// ── Helpers ───────────────────────────────────────────────────

function parseDateRange(req: AuthRequest): { from: Date; to: Date } {
  const days = Number(req.query['days'] ?? 30)
  const to = new Date()
  to.setUTCHours(23, 59, 59, 999)
  const from = new Date()
  from.setUTCDate(from.getUTCDate() - Math.min(Math.max(days, 1), 365))
  from.setUTCHours(0, 0, 0, 0)
  return { from, to }
}

function getOrgId(req: AuthRequest): string | null {
  return (req.headers['x-org-id'] as string) || null
}

// ── GET /api/metrics/overview ─────────────────────────────────
// Returns the latest snapshot per connected platform + 30-day trend

export async function getOverviewMetrics(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id header required' }); return }

  const { from } = parseDateRange(req)

  const accounts = await prisma.socialAccount.findMany({
    where: { orgId },
    include: {
      metrics: {
        where: { snapshotDate: { gte: from } },
        orderBy: { snapshotDate: 'asc' },
      },
    },
  })

  const overview = accounts.map((account) => {
    const sorted = [...account.metrics].sort(
      (a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime(),
    )
    const latest = sorted[0]
    const oldest = sorted[sorted.length - 1]

    const followerGrowth = latest && oldest && oldest.followers > 0
      ? ((latest.followers - oldest.followers) / oldest.followers) * 100
      : 0

    return {
      platform: account.platform,
      handle: account.handle,
      profileUrl: account.profileUrl,
      connectedAt: account.connectedAt,
      latest: latest
        ? {
            followers: latest.followers,
            following: latest.following,
            posts: latest.posts,
            engagementRate: latest.engagementRate,
            reach: latest.reach,
            impressions: latest.impressions,
            avgLikes: latest.avgLikes,
            avgComments: latest.avgComments,
            snapshotDate: latest.snapshotDate,
          }
        : null,
      followerGrowthPct: Math.round(followerGrowth * 100) / 100,
      trendData: sorted.reverse().map((m) => ({
        date: m.snapshotDate,
        followers: m.followers,
        reach: m.reach,
        engagementRate: m.engagementRate,
      })),
    }
  })

  res.json({ data: { overview } })
}

// ── GET /api/metrics/:platform ────────────────────────────────
// Returns detailed time-series for a single platform

export async function getPlatformMetrics(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id header required' }); return }

  const platform = (req.params['platform'] as string).toUpperCase()
  const VALID_PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE']
  if (!VALID_PLATFORMS.includes(platform)) {
    res.status(400).json({ error: 'Invalid platform', message: `Must be one of: ${VALID_PLATFORMS.join(', ')}` })
    return
  }

  const { from, to } = parseDateRange(req)

  const account = await prisma.socialAccount.findFirst({
    where: { orgId, platform: platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' },
    include: {
      metrics: {
        where: {
          snapshotDate: { gte: from, lte: to },
        },
        orderBy: { snapshotDate: 'asc' },
      },
    },
  })

  if (!account) {
    res.status(404).json({
      error: 'Not Found',
      message: `No ${platform} account connected for this organization`,
    })
    return
  }

  if (account.metrics.length === 0) {
    res.json({
      data: {
        platform,
        handle: account.handle,
        profileUrl: account.profileUrl,
        connectedAt: account.connectedAt,
        metrics: [],
        summary: null,
      },
    })
    return
  }

  const latest = account.metrics[account.metrics.length - 1]!
  const oldest = account.metrics[0]!

  const followerGrowth = oldest.followers > 0
    ? ((latest.followers - oldest.followers) / oldest.followers) * 100
    : 0

  const avgEngagement =
    account.metrics.reduce((s, m) => s + m.engagementRate, 0) / account.metrics.length

  res.json({
    data: {
      platform,
      handle: account.handle,
      profileUrl: account.profileUrl,
      connectedAt: account.connectedAt,
      summary: {
        currentFollowers: latest.followers,
        followerGrowthPct: Math.round(followerGrowth * 100) / 100,
        avgEngagementRate: Math.round(avgEngagement * 100) / 100,
        totalReach: account.metrics.reduce((s, m) => s + m.reach, 0),
        totalImpressions: account.metrics.reduce((s, m) => s + m.impressions, 0),
        avgLikes: latest.avgLikes,
        avgComments: latest.avgComments,
        snapshotDate: latest.snapshotDate,
      },
      metrics: account.metrics.map((m) => ({
        date: m.snapshotDate,
        followers: m.followers,
        following: m.following,
        posts: m.posts,
        engagementRate: m.engagementRate,
        reach: m.reach,
        impressions: m.impressions,
        avgLikes: m.avgLikes,
        avgComments: m.avgComments,
      })),
    },
  })
}

// ── GET /api/metrics/kpis ─────────────────────────────────────
// Returns KPI cards for the dashboard — total followers, avg engagement, etc.

export async function getKpiMetrics(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id header required' }); return }

  // Get the most recent snapshot per account
  const accounts = await prisma.socialAccount.findMany({
    where: { orgId },
    include: {
      metrics: {
        orderBy: { snapshotDate: 'desc' },
        take: 2, // latest + 1 prev for delta
      },
    },
  })

  let totalFollowers = 0
  let totalReach = 0
  let totalImpressions = 0
  const engagementRates: number[] = []
  const kpiByPlatform: Record<string, {
    followers: number
    followersDelta: number
    engagementRate: number
    reach: number
    impressions: number
  }> = {}

  for (const account of accounts) {
    const [latest, prev] = account.metrics
    if (!latest) continue

    totalFollowers += latest.followers
    totalReach += latest.reach
    totalImpressions += latest.impressions
    if (latest.engagementRate > 0) engagementRates.push(latest.engagementRate)

    kpiByPlatform[account.platform] = {
      followers: latest.followers,
      followersDelta: prev ? latest.followers - prev.followers : 0,
      engagementRate: latest.engagementRate,
      reach: latest.reach,
      impressions: latest.impressions,
    }
  }

  const avgEngagementRate = engagementRates.length > 0
    ? engagementRates.reduce((s, r) => s + r, 0) / engagementRates.length
    : 0

  res.json({
    data: {
      kpis: {
        totalFollowers,
        totalReach,
        totalImpressions,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
      },
      byPlatform: kpiByPlatform,
    },
  })
}
