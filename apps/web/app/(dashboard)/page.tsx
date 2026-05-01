'use client'

import React, { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Users, TrendingUp, Eye, BarChart2, Lightbulb, RefreshCw,
  CheckSquare, CalendarDays, Sparkles, ArrowRight, Brain,
  Star, Globe, Shield, Activity, Flame, Zap, ArrowUpRight,
  Instagram, Facebook, Youtube, Loader2,
} from 'lucide-react'
import {
  metricsApi, competitorApi, briefApi, checklistApi,
  opsApi, reputationApi, orgResearchApi,
  type KpiResponse, type OPSBreakdown, type ReputationReport,
} from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/shared/KpiCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatNumber, cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { toast } from 'sonner'

// ── OPS Gauge ─────────────────────────────────────────────────

function OPSGauge({ score, tier }: { score: number; tier: string }) {
  const radius = 56
  const stroke = 10
  const norm = radius - stroke / 2
  const circ = Math.PI * norm  // half-circle

  const tierColors: Record<string, string> = {
    Building: '#f59e0b',
    Developing: '#3b82f6',
    Established: '#8b5cf6',
    Authority: '#10b981',
  }
  const color = tierColors[tier] ?? '#6366f1'

  const dashOffset = circ - (score / 100) * circ

  return (
    <div className="relative flex flex-col items-center">
      <svg width={140} height={80} viewBox="0 0 140 80">
        {/* Background arc */}
        <path
          d="M 14 74 A 56 56 0 0 1 126 74"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d="M 14 74 A 56 56 0 0 1 126 74"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className="text-3xl font-black text-[var(--color-text)]">{score}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
          {tier}
        </span>
      </div>
    </div>
  )
}

// ── OPS Component Bar ─────────────────────────────────────────

function ComponentBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--color-text-3)]">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-text-4)]">{weight}%</span>
          <span className="text-[11px] font-semibold text-[var(--color-text-2)]">{score}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ── Star Rating ───────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="h-3.5 w-3.5"
          fill={i <= Math.round(rating) ? '#f59e0b' : 'none'}
          stroke={i <= Math.round(rating) ? '#f59e0b' : 'var(--color-border-2)'}
        />
      ))}
    </div>
  )
}

// ── Platform icon ──────────────────────────────────────────────

function PlatformIcon({ platform }: { platform: string }) {
  const map: Record<string, React.ReactNode> = {
    INSTAGRAM: <Instagram className="h-3.5 w-3.5" />,
    FACEBOOK: <Facebook className="h-3.5 w-3.5" />,
    YOUTUBE: <Youtube className="h-3.5 w-3.5" />,
  }
  return <>{map[platform] ?? <Globe className="h-3.5 w-3.5" />}</>
}

// ── Dashboard Page ────────────────────────────────────────────

export default function DashboardPage() {
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''
  const qc = useQueryClient()

  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['metrics', 'kpis'],
    queryFn: () => metricsApi.kpis(),
    enabled: !!orgId,
  })

  const { data: briefData } = useQuery({
    queryKey: ['daily-brief'],
    queryFn: () => briefApi.today(),
    enabled: !!orgId,
  })

  const { data: competitorData } = useQuery({
    queryKey: ['competitors'],
    queryFn: () => competitorApi.list(),
    enabled: !!orgId,
  })

  const { data: checklistData } = useQuery({
    queryKey: ['checklist'],
    queryFn: () => checklistApi.get(),
    enabled: !!orgId,
  })

  const { data: opsData, isLoading: opsLoading } = useQuery({
    queryKey: ['ops', orgId],
    queryFn: () => opsApi.get(),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30,
  })

  const { data: repData } = useQuery({
    queryKey: ['reputation', orgId],
    queryFn: () => reputationApi.get(),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 60,
  })

  const recalcOPS = useMutation({
    mutationFn: () => opsApi.recalc(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', orgId] })
      toast.success('OPS score recalculated')
    },
    onError: () => toast.error('Failed to recalculate OPS'),
  })

  const kpis = (kpiData as KpiResponse | undefined)?.kpis
  const brief = briefData?.brief
  const competitors = competitorData?.competitors ?? []
  const checklistItems = checklistData?.items ?? []
  const checklistDone = checklistItems.filter((i) => i.isDone).length
  const checklistPct = checklistItems.length > 0 ? Math.round((checklistDone / checklistItems.length) * 100) : 0
  const ops = (opsData as { ops: OPSBreakdown } | undefined)?.ops
  const reputation = (repData as { reputation: ReputationReport } | undefined)?.reputation

  // When KPIs are all zero, immediately kick off AI research and poll every 25s
  const kpisAllZero = !kpiLoading && kpis !== undefined && kpis.totalFollowers === 0
  useEffect(() => {
    if (!kpisAllZero || !orgId) return
    // Fire research immediately (non-blocking)
    orgResearchApi.research(orgId).catch(() => {/* swallow — bootstrap also runs server-side */})
    // Then poll every 25s until data appears
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['metrics', 'kpis'] })
    }, 25_000)
    return () => clearInterval(t)
  }, [kpisAllZero, orgId, qc])

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back${activeOrg?.name ? `, ${activeOrg.name}` : ''}. Here's your brand intelligence overview.`}
      />

      {/* ── AI syncing banner (first-time, no data yet) ── */}
      {kpisAllZero && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-[var(--color-accent)] animate-pulse" />
          <p className="text-sm text-[var(--color-text-2)]">
            <span className="font-semibold text-[var(--color-accent)]">AI is analyzing your brand</span>
            {' — '}generating your first intelligence report and baseline metrics. This takes about 30 seconds.
          </p>
          <Button
            variant="ghost" size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ['metrics', 'kpis'] })}
            className="ml-auto shrink-0 h-7 px-2 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />Refresh
          </Button>
        </div>
      )}

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
          label="Avg engagement"
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
          label="Checklist"
          value={checklistPct}
          format="percent"
          icon={<CheckSquare className="h-4 w-4" />}
        />
      </div>

      {/* ── OPS + Reputation row ── */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* OPS Score Card */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" />
                Online Presence Score
              </CardTitle>
              <div className="flex items-center gap-2">
                <Link href="/summary">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    Full report <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => recalcOPS.mutate()}
                  disabled={recalcOPS.isPending}
                >
                  {recalcOPS.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {opsLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-4)] py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating presence score…
              </div>
            ) : ops ? (
              <div className="flex items-start gap-6">
                <div className="shrink-0">
                  <OPSGauge score={ops.overall} tier={ops.tier} />
                  <p className="text-[10px] text-center text-[var(--color-text-4)] mt-1">out of 100</p>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {ops.components && Object.entries(ops.components).map(([key, comp]) => (
                    <ComponentBar
                      key={key}
                      label={(comp as { label: string; score: number; weight: number }).label}
                      score={(comp as { label: string; score: number; weight: number }).score}
                      weight={(comp as { label: string; score: number; weight: number }).weight}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Activity className="h-8 w-8" />}
                heading="No score yet"
                description="Run a research scan from the Summary page to generate your OPS score."
                action={{ label: 'Go to Summary', href: '/summary' }}
                className="py-6"
              />
            )}

            {ops && (ops.recommendations?.length ?? 0) > 0 && (
              <div className="mt-4 space-y-1 border-t border-[var(--color-border)] pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-4)] mb-2">
                  Top Recommendations
                </p>
                {(ops.recommendations ?? []).slice(0, 2).map((rec, i) => (
                  <p key={i} className="text-xs text-[var(--color-text-2)]">{rec}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reputation Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-accent" />
                Reputation
              </CardTitle>
              <Link href="/reputation">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  Details <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {reputation ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-2">
                  <span className="text-4xl font-black text-[var(--color-text)]">
                    {reputation.overallRating.toFixed(1)}
                  </span>
                  <StarRating rating={reputation.overallRating} />
                  <p className="mt-1 text-[10px] text-[var(--color-text-4)]">
                    {reputation.totalReviews.toLocaleString()} reviews
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Positive', value: reputation.positiveCount, color: 'var(--color-success-text)' },
                    { label: 'Neutral', value: reputation.neutralCount, color: 'var(--color-text-3)' },
                    { label: 'Negative', value: reputation.negativeCount, color: 'var(--color-danger)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-[var(--color-surface-2)] p-2">
                      <p className="text-sm font-bold" style={{ color }}>{value}</p>
                      <p className="text-[10px] text-[var(--color-text-4)]">{label}</p>
                    </div>
                  ))}
                </div>

                {(reputation.topThemes?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-4)] mb-2">
                      Top Themes
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {reputation.topThemes.slice(0, 4).map((theme) => (
                        <Badge key={theme} variant="outline" className="text-[10px] h-5 px-1.5">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<Star className="h-8 w-8" />}
                heading="No reputation data"
                description="We'll analyse reviews and mentions automatically."
                action={{ label: 'Analyse now', href: '/reputation' }}
                className="py-6"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Daily Brief + Competitors row ── */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">

        {/* Daily Brief */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />Daily Brief
              </CardTitle>
              <Link href="/brief">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  View <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {brief ? (
              <div className="space-y-3">
                {brief.summary && (
                  <p className="text-sm text-[var(--color-text-2)] line-clamp-3">{brief.summary}</p>
                )}
                {(brief.actionItems?.length ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">
                      Today&apos;s Actions
                    </p>
                    {(brief.actionItems ?? []).slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <p className="text-xs text-[var(--color-text-2)]">{item}</p>
                      </div>
                    ))}
                  </div>
                )}
                {brief.ideaOfDay && (
                  <div className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <p className="text-xs text-[var(--color-text-2)]">{brief.ideaOfDay}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<Sparkles className="h-8 w-8" />}
                heading="No brief today"
                description="Generate your daily brief to see AI insights."
                action={{ label: 'Generate', href: '/brief' }}
                className="py-6"
              />
            )}
          </CardContent>
        </Card>

        {/* Competitor snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-accent" />Competitor Snapshot
              </CardTitle>
              <Link href="/competitors">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {competitors.length === 0 ? (
              <EmptyState
                icon={<BarChart2 className="h-8 w-8" />}
                heading="No competitors tracked"
                description="AI will discover competitors automatically."
                action={{ label: 'Discover', href: '/competitors' }}
                className="py-6"
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border bg-surface-2">
                    {['Account', 'Platform', 'Followers', 'Eng.'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-3)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {competitors.slice(0, 5).map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-brand-border last:border-0 hover:bg-surface-2 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-xs font-medium text-[var(--color-text)]">{c.name}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 text-[var(--color-text-3)]">
                          <PlatformIcon platform={c.platform} />
                          <Badge variant="outline" className="text-[10px] h-4 px-1">{c.platform}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-2)]">
                        {c.latestMetrics?.followers != null ? formatNumber(c.latestMetrics.followers) : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-2)]">
                        {c.latestMetrics?.engagementRate != null
                          ? `${c.latestMetrics.engagementRate.toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick links ── */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Analytics', href: '/analytics', icon: TrendingUp, desc: 'View metrics' },
          { label: 'Trending', href: '/studio/trends', icon: Flame, desc: 'Hot topics' },
          { label: 'Calendar', href: '/studio/calendar', icon: CalendarDays, desc: 'Plan content' },
          { label: 'Ideas Bank', href: '/ideas', icon: Lightbulb, desc: 'Browse ideas' },
          { label: 'Summary', href: '/summary', icon: Brain, desc: 'AI intelligence' },
          { label: 'Reputation', href: '/reputation', icon: Shield, desc: 'Reviews & mentions' },
          { label: 'SEO', href: '/analytics/seo', icon: Globe, desc: 'Search rankings' },
          { label: 'Competitors', href: '/competitors', icon: Zap, desc: 'Competitive intel' },
        ].map(({ label, href, icon: Icon, desc }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-brand-border-2 transition-colors cursor-pointer">
              <CardContent className="p-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-light text-accent shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text)]">{label}</p>
                  <p className="text-[10px] text-[var(--color-text-4)]">{desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
