'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Instagram, Facebook, Youtube, TrendingUp, Users, Eye, BarChart2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { metricsApi } from '@/lib/api'
import type { OverviewPlatform, KpiResponse } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber, formatPercent } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Platform config ───────────────────────────────────────────

const PLATFORM_CONFIG = {
  INSTAGRAM: {
    label: 'Instagram',
    icon: Instagram,
    color: 'var(--platform-instagram)',
    chartColor: 'var(--chart-1)',
    href: '/analytics/instagram',
  },
  FACEBOOK: {
    label: 'Facebook',
    icon: Facebook,
    color: 'var(--platform-facebook)',
    chartColor: 'var(--chart-2)',
    href: '/analytics/facebook',
  },
  YOUTUBE: {
    label: 'YouTube',
    icon: Youtube,
    color: 'var(--platform-youtube)',
    chartColor: 'var(--chart-3)',
    href: '/analytics/youtube',
  },
} as const

// ── Day range selector ────────────────────────────────────────

const DAY_OPTIONS = [7, 14, 30, 90] as const
type DayRange = (typeof DAY_OPTIONS)[number]

// ── Custom tooltip ────────────────────────────────────────────

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-brand-border-2 bg-surface p-3 shadow-md text-sm">
      <p className="mb-2 font-medium text-[var(--color-text)] text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 text-[var(--color-text-2)]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="capitalize text-xs">{p.name}</span>
          </div>
          <span className="font-mono font-semibold text-xs">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Platform card ─────────────────────────────────────────────

function PlatformCard({ platform }: { platform: OverviewPlatform }) {
  const config = PLATFORM_CONFIG[platform.platform as keyof typeof PLATFORM_CONFIG]
  if (!config) return null
  const Icon = config.icon

  const trendFormatted = platform.trendData.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <Card className="flex flex-col gap-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: `${config.color}20`, color: config.color }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
              {platform.handle && (
                <p className="text-xs text-[var(--color-text-4)] font-mono">@{platform.handle}</p>
              )}
            </div>
          </div>
          <Link href={config.href}>
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View details →
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {platform.latest ? (
          <>
            {/* Stats row */}
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-surface-2 p-2.5 text-center">
                <p className="font-mono text-lg font-bold tabular-nums text-[var(--color-text)]">
                  {formatNumber(platform.latest.followers)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">Followers</p>
                {platform.followerGrowthPct !== 0 && (
                  <p className={`text-[10px] font-medium mt-0.5 ${platform.followerGrowthPct > 0 ? 'text-success' : 'text-danger'}`}>
                    {platform.followerGrowthPct > 0 ? '+' : ''}{platform.followerGrowthPct.toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-surface-2 p-2.5 text-center">
                <p className="font-mono text-lg font-bold tabular-nums text-[var(--color-text)]">
                  {platform.latest.engagementRate.toFixed(1)}%
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">Eng. Rate</p>
              </div>
              <div className="rounded-lg bg-surface-2 p-2.5 text-center">
                <p className="font-mono text-lg font-bold tabular-nums text-[var(--color-text)]">
                  {formatNumber(platform.latest.reach)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">Reach</p>
              </div>
            </div>

            {/* Mini trend chart */}
            {trendFormatted.length > 1 && (
              <ResponsiveContainer width="100%" height={90}>
                <LineChart data={trendFormatted} margin={{ top: 2, right: 2, left: -32, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="followers"
                    name="Followers"
                    stroke={config.chartColor}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </>
        ) : (
          <p className="py-4 text-center text-sm text-[var(--color-text-4)]">
            No data yet — sync pending
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Cross-platform follower trend ─────────────────────────────

function CrossPlatformChart({ overview }: { overview: OverviewPlatform[] }) {
  // Build unified date-keyed series
  const dateMap: Record<string, Record<string, number>> = {}

  for (const platform of overview) {
    const config = PLATFORM_CONFIG[platform.platform as keyof typeof PLATFORM_CONFIG]
    if (!config) continue
    for (const point of platform.trendData) {
      const date = new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!dateMap[date]) dateMap[date] = {}
      dateMap[date][config.label] = point.followers
    }
  }

  const chartData = Object.entries(dateMap).map(([date, vals]) => ({ date, ...vals }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-3)]">
          Follower trend — all platforms
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
            <ReTooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-[var(--color-text-3)]">{v}</span>} />
            {overview.map((p) => {
              const config = PLATFORM_CONFIG[p.platform as keyof typeof PLATFORM_CONFIG]
              if (!config) return null
              return (
                <Line
                  key={p.platform}
                  type="monotone"
                  dataKey={config.label}
                  stroke={config.chartColor}
                  strokeWidth={2}
                  dot={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function AnalyticsOverviewPage() {
  const [days, setDays] = useState<DayRange>(30)

  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['metrics', 'kpis'],
    queryFn: () => metricsApi.kpis(),
  })

  const { data: overviewData, isLoading: overviewLoading, refetch, isFetching } = useQuery({
    queryKey: ['metrics', 'overview', days],
    queryFn: () => metricsApi.overview(days),
  })

  const kpis = (kpiData as KpiResponse | undefined)?.kpis
  const overview = (overviewData as { overview: OverviewPlatform[] } | undefined)?.overview ?? []

  const hasConnectedAccounts = overview.length > 0

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Aggregated performance across all connected platforms."
        actions={
          <div className="flex items-center gap-2">
            {/* Day range selector */}
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

      {!hasConnectedAccounts && !overviewLoading ? (
        <Card className="mt-2">
          <CardContent className="p-0">
            <EmptyState
              icon={<BarChart2 className="h-12 w-12" />}
              heading="No social accounts connected"
              description="Connect your Instagram, Facebook, or YouTube accounts to start seeing analytics."
              action={{ label: 'Connect accounts', href: '/settings/accounts' }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total followers"
              value={kpis?.totalFollowers ?? 0}
              format="number"
              icon={<Users className="h-4 w-4" />}
              loading={kpiLoading}
            />
            <KpiCard
              label="Avg engagement rate"
              value={kpis?.avgEngagementRate ?? 0}
              format="percent"
              icon={<TrendingUp className="h-4 w-4" />}
              loading={kpiLoading}
            />
            <KpiCard
              label="Total reach"
              value={kpis?.totalReach ?? 0}
              format="number"
              icon={<Eye className="h-4 w-4" />}
              loading={kpiLoading}
            />
            <KpiCard
              label="Total impressions"
              value={kpis?.totalImpressions ?? 0}
              format="number"
              icon={<BarChart2 className="h-4 w-4" />}
              loading={kpiLoading}
            />
          </div>

          {/* ── Cross-platform trend ── */}
          {(overviewLoading || overview.length > 0) && (
            <div className="mt-6">
              {overviewLoading ? (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="skeleton h-3 w-48 rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="skeleton h-[240px] w-full rounded" />
                  </CardContent>
                </Card>
              ) : (
                <CrossPlatformChart overview={overview} />
              )}
            </div>
          )}

          {/* ── Per-platform cards ── */}
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {overviewLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6 space-y-3">
                      <div className="skeleton h-4 w-32 rounded" />
                      <div className="skeleton h-24 w-full rounded" />
                      <div className="skeleton h-[90px] w-full rounded" />
                    </CardContent>
                  </Card>
                ))
              : overview.map((platform) => (
                  <PlatformCard key={platform.platform} platform={platform} />
                ))}
          </div>
        </>
      )}
    </>
  )
}
