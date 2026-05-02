/**
 * Metrics controller
 * Reads aggregated + per-platform metrics from DB (never from social APIs directly).
 * All data was written by BullMQ workers via socialDataService.
 *
 * Auto-bootstrap: when no metrics exist for a connected account, kicks off
 * deepResearchOrg asynchronously so next page load shows estimated data.
 */

import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { deepResearchOrg, isResearchStale } from '../services/intelligence/deepResearchService'

// Fire-and-forget deep research to populate estimated metrics
function bootstrapIfNeeded(orgId: string): void {
  isResearchStale(orgId).then((stale) => {
    if (stale) {
      deepResearchOrg(orgId).catch((err) => {
        console.warn(`[metrics] bootstrap deepResearch failed for org ${orgId}:`, (err as Error).message)
      })
    }
  }).catch(() => {/* ignore */})
}

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

    const isEstimated = latest
      ? (latest.rawJson as { isEstimated?: boolean } | null)?.isEstimated === true
      : false

    return {
      platform: account.platform,
      handle: account.handle,
      profileUrl: account.profileUrl,
      connectedAt: account.connectedAt,
      isEstimated,
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
    // Kick off background bootstrap so next load has data
    bootstrapIfNeeded(orgId)
    res.json({
      data: {
        platform,
        handle: account.handle,
        profileUrl: account.profileUrl,
        connectedAt: account.connectedAt,
        metrics: [],
        summary: null,
        syncing: true,
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

  // If ALL accounts have zero metrics, trigger background bootstrap
  const allEmpty = accounts.every((a) => a.metrics.length === 0 || a.metrics[0]!.followers === 0)
  if (allEmpty && accounts.length > 0) bootstrapIfNeeded(orgId)

  let totalFollowers = 0
  let totalReach = 0
  let totalImpressions = 0
  const engagementRates: numb