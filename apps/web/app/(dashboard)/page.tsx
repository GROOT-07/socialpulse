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
      <div className="grid grid-cols-1 gap-4 