'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, AlertTriangle, Link2Off, Instagram, Facebook, Youtube, Sparkles } from 'lucide-react'
import { usePlatformMetrics } from '@/hooks/usePlatformMetrics'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FollowerTrendChart,
  EngagementChart,
  ReachImpressionsChart,
  EngagementBreakdownChart,
} from '@/components/analytics/MetricsChart'
import { Users, TrendingUp, Eye, BarChart2, Heart, MessageCircle } from 'lucide-react'

// ── Day range selector ────────────────────────────────────────

const DAY_OPTIONS = [7, 14, 30, 90] as const
type DayRange = (typeof DAY_OPTIONS)[number]

// ── Platform config ───────────────────────────────────────────

const PLATFORM_META = {
  instagram: { label: 'Instagram', Icon: Instagram, iconColor: 'var(--platform-instagram)', chartColor: 'var(--chart-1)' },
  facebook:  { label: 'Facebook',  Icon: Facebook,  iconColor: 'var(--platform-facebook)',  chartColor: 'var(--chart-2)' },
  youtube:   { label: 'YouTube',   Icon: Youtube,   iconColor: 'var(--platform-youtube)',   chartColor: 'var(--chart-3)' },
} as const

// ── Props ─────────────────────────────────────────────────────

interface PlatformAnalyticsPageProps {
  platform: 'instagram' | 'facebook' | 'youtube'
}

// ── Page ──────────────────────────────────────────────────────

export function PlatformAnalyticsPage({ platform }: PlatformAnalyticsPageProps) {
  const { label, Icon, iconColor, chartColor } = PLATFORM_META[platform]
  const [days, setDays] = useState<DayRange>(30)

  const { data, isLoading, isError, error, refetch, isFetching } = usePlatformMetrics(platform, days)

  const isNotConnected = isError && (error as { status?: number })?.status === 404

  // Detect all-zero state (account connected, metrics exist but all 0)
  const hasZeroMetrics = !isLoading && !isError && data && data.metrics.length > 0
    && (data.summary?.currentFollowers ?? 0) === 0

  // Auto-refetch after 20s when syncing so estimates appear automatically
  useEffect(() => {
    if (!data?.syncing && !hasZeroMetrics) return
    const t = setTimeout(() => { refetch() }, 20_000)
    return () => clearTimeout(t)
  }, [data?.syncing, hasZeroMetrics, refetch])

  return (
    <>
      <PageHeader
        title={`${label} Analytics`}
        description={`Performance metrics for your connected ${label} account.`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-brand-border bg-surface-2 p-0.5">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    days === d
                      ? 'bg-surface text-[var(--color-text)] shadow-sm'
                      : 'text-[var(--color-text-4)] hover:text-[var(--color-text-2)]'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 w-8 p-0"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* ── Not connected ── */}
      {isNotConnected && (
        <Card className="mt-2">
          <CardContent className="p-0">
            <EmptyState
              icon={<Link2Off className="h-12 w-12" />}
              heading={`${label} not connected`}
              description={`Connect your ${label} account to start tracking analytics.`}
              action={{ label: 'Connect accounts', href: '/settings/accounts' }}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Generic error ── */}
      {isError && !isNotConnected && (
        <Card className="mt-2">
          <CardContent className="p-0">
            <EmptyState
              icon={<AlertTriangle className="h-12 w-12 text-warning" />}
              heading="Failed to load metrics"
              description={(error as Error)?.message ?? 'Something went wrong. Try refreshing.'}
              action={{ label: 'Retry', onClick: () => refetch() }}
            />
          </CardContent>
        </Card>
      )}

      {/* ── No data yet (connected but no snapshots) ── */}
      {!isLoading && !isError && data && data.metrics.length === 0 && (
        <Card className="mt-2">
          <CardContent className="p-0">
            <EmptyState
              icon={<Sparkles className="h-12 w-12 text-[var(--color-accent)]" />}
              heading="AI is generating your estimates"
              description="Your account is connected. Our AI is analysing your profile and generating realistic baseline metrics. This takes about 30 seconds — the page will refresh automatically."
              action={{ label: 'Refresh now', onClick: () => refetch() }}
            />
          </CardContent>
        </Card>
      )}

      {/* ── AI Syncing banner (account connected, metrics exist but all zero) ── */}
      {(hasZeroMetrics || data?.syncing) && (
        <div className="mt-2 mb-4 flex items-center gap-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-[var(--color-accent)] animate-pulse" />
          <p className="text-sm text-[var(--color-text-2)]">
            <span className="font-semibold text-[var(--color-accent)]">AI analysis in progress</span>
            {' — '}our AI is building your baseline metrics. Data will appear shortly.
            Auto-refreshing in 20 seconds.
          </p>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto shrink-0 h-7 px-2 text-xs">
            Refresh now
          </Button>
        </div>
      )}

      {/* ── Data ── */}
      {(isLoading || (data && data.metrics.length > 0)) && (
        <>
          {/* Account header */}
          {!isLoading && data && (
            <div className="mb-6 flex items-center gap-3">
              {data.profileUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.profileUrl}
                  alt={data.handle ?? label}
                  className="h-10 w-10 rounded-full ring-2 ring-brand-border"
                />
              )}
              <div>
                <p className="font-semibold text-[var(--color-text)]">
                  {data.handle ?? label}
                </p>
                <p className="text-xs text-[var(--color-text-4)]">
                  Connected · last {days} days
                </p>
              </div>
              <span
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: `${iconColor}20`, color: iconColor }}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Followers"
              value={data?.summary?.currentFollowers ?? 0}
              delta={data?.summary ? undefined : undefined}
              deltaLabel={data?.summary ? `${data.summary.followerGrowthPct > 0 ? '+' : ''}${data.summary.followerGrowthPct.toFixed(1)}% this period` : undefined}
              format="number"
              icon={<Users className="h-4 w-4" />}
              loading={isLoading}
            />
            <KpiCard
              label="Avg engagement rate"
              value={data?.summary?.avgEngagementRate ?? 0}
              format="percent"
              icon={<TrendingUp className="h-4 w-4" />}
              loading={isLoading}
            />
            <KpiCard
              label="Total reach"
              value={data?.summary?.totalReach ?? 0}
              format="number"
              icon={<Eye className="h-4 w-4" />}
              loading={isLoading}
            />
            <KpiCard
              label="Total impressions"
              value={data?.summary?.totalImpre