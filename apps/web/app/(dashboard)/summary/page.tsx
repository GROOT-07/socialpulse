'use client'

/**
 * Organization Summary Page — Claude-first intelligence engine.
 *
 * On first load (or stale data >24 h), the backend runs deepResearchOrg()
 * via Claude API, which populates OrgIntelligence, Competitors, Keywords,
 * and AI-estimated SocialMetrics — no external API keys needed.
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  RefreshCcw, Sparkles, ArrowRight, Instagram, Facebook, Youtube,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Calendar, ExternalLink, Building2, Loader2,
  BarChart3, Target, Search, ChevronRight, Brain,
  Award, Lightbulb, MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────

interface OrgIntelligence {
  presenceScore: number
  detectedKeywords: string[]
  strengths: string[]
  urgentIssues: Array<{ issue: string; actionLink: string }> | null
  quickWins: Array<{ action: string; impact: string }> | null
  aiDiagnosis: Record<string, unknown> | null
  lastScannedAt: string | null
}

interface PlatformOverview {
  platform: string
  handle: string | null
  profileUrl: string | null
  isEstimated: boolean
  latest: {
    followers: number
    engagementRate: number
    posts: number
    avgLikes: number
    avgComments: number
    reach: number
  } | null
  followerGrowthPct: number
}

interface Competitor {
  id: string
  handle: string
  name: string
  platform: string
  profileUrl: string | null
  latestMetrics: { followers: number; engagementRate: number; avgLikes: number } | null
}

interface KeywordOpportunity {
  keyword: string
  searchVolume: number
  difficulty: number
  category: string
}

interface CalendarPost {
  id: string
  date: string
  platform: string
  topic: string
  format: string
}

// ── Platform config ───────────────────────────────────────────

const PLATFORM_CFG: Record<string, {
  label: string
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  bg: string
}> = {
  INSTAGRAM: { label: 'Instagram', Icon: Instagram, color: '#E1306C', bg: '#E1306C18' },
  FACEBOOK:  { label: 'Facebook',  Icon: Facebook,  color: '#1877F2', bg: '#1877F218' },
  YOUTUBE:   { label: 'YouTube',   Icon: Youtube,   color: '#FF0000', bg: '#FF000018' },
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function diffLabel(d: number): { label: string; color: string } {
  if (d < 30) return { label: 'Easy', color: '#22C55E' }
  if (d < 60) return { label: 'Medium', color: '#F59E0B' }
  return { label: 'Hard', color: '#EF4444' }
}

// ── Presence Arc ──────────────────────────────────────────────

function PresenceArc({ score }: { score: number }) {
  const r = 54, cx = 64, cy = 64
  const circ = Math.PI * r
  const filled = (score / 100) * circ
  const color = score < 35 ? '#EF4444' : score < 60 ? '#F59E0B' : '#22C55E'
  const label = score < 35 ? 'Building' : score < 60 ? 'Growing' : 'Strong'
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 128 80" className="w-40 h-24">
        <path d={`M 10 70 A ${r} ${r} 0 0 1 118 70`} fill="none" stroke="var(--color-border)" strokeWidth="10" strokeLinecap="round" />
        <path d={`M 10 70 A ${r} ${r} 0 0 1 118 70`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="64" y="62" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--color-text)">{score}</text>
        <text x="64" y="76" textAnchor="middle" fontSize="9" fill="var(--color-text-3)">/100</text>
      </svg>
      <span className="text-xs font-semibold mt-1" style={{ color }}>{label} Presence</span>
    </div>
  )
}

// ── Platform Card ─────────────────────────────────────────────

function PlatformCard({ data }: { data: PlatformOverview }) {
  const cfg = PLATFORM_CFG[data.platform]
  if (!cfg) return null
  const { Icon, color, bg } = cfg
  const m = data.latest
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: bg }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <p className="font-semibold text-sm text-[var(--color-text)]">{cfg.label}</p>
            {data.handle && <p className="text-[11px] text-[var(--color-text-4)]">@{data.handle}</p>}
          </div>
        </div>
        <Badge variant="outline" className={cn('text-[9px]', data.isEstimated ? 'border-[var(--color-border)] text-[var(--color-text-4)]' : 'border-green-500/30 text-green-500')}>
          {data.isEstimated ? 'AI estimate' : 'Live data'}
        </Badge>
      </div>

      {m ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: bg }}>
              <p className="text-[10px] text-[var(--color-text-4)] mb-0.5">Followers</p>
              <p className="text-lg font-bold" style={{ color }}>{fmt(m.followers)}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {data.followerGrowthPct > 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : data.followerGrowthPct < 0 ? <TrendingDown className="h-3 w-3 text-red-500" /> : <Minus className="h-3 w-3 text-[var(--color-text-4)]" />}
                <span className={cn('text-[10px]', data.followerGrowthPct > 0 ? 'text-green-500' : data.followerGrowthPct < 0 ? 'text-red-500' : 'text-[var(--color-text-4)]')}>
                  {data.followerGrowthPct > 0 ? '+' : ''}{data.followerGrowthPct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="rounded-lg p-3 bg-[var(--color-surface-2)]">
              <p className="text-[10px] text-[var(--color-text-4)] mb-0.5">Engagement</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{m.engagementRate.toFixed(1)}%</p>
              <p className="text-[10px] text-[var(--color-text-4)] mt-0.5">{fmt(m.posts)} posts</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs font-semibold text-[var(--color-text)]">{fmt(m.avgLikes)}</p><p className="text-[10px] text-[var(--color-text-4)]">Avg likes</p></div>
            <div><p className="text-xs font-semibold text-[var(--color-text)]">{fmt(m.avgComments)}</p><p className="text-[10px] text-[var(--color-text-4)]">Avg comments</p></div>
            <div><p className="text-xs font-semibold text-[var(--color-text)]">{fmt(m.reach)}</p><p className="text-[10px] text-[var(--color-text-4)]">Reach</p></div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center py-4 gap-2">
          <Icon className="h-8 w-8 text-[var(--color-text-4)]" />
          <p className="text-xs text-[var(--color-text-4)] text-center">No metrics yet</p>
        </div>
      )}

      {data.profileUrl && (
        <a href={data.profileUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-4)] hover:text-[var(--color-accent)] transition-colors">
          <ExternalLink className="h-3 w-3" /> View profile
        </a>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function SummaryPage() {
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''
  const queryClient = useQueryClient()

  const { data: intel, isLoading: intelLoading } = useQuery({
    queryKey: ['intelligence', orgId],
    queryFn: () => apiClient.get<OrgIntelligence>(`/api/orgs/${orgId}/intelligence`),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 60,
    retry: false,
  })

  const { data: overviewData, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics-overview', orgId],
    queryFn: () => apiClient.get<{ overview: PlatformOverview[] }>('/api/metrics/overview?days=30'),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

  const { data: competitorData, isLoading: compLoading } = useQuery({
    queryKey: ['competitors', orgId],
    queryFn: () => apiClient.get<{ competitors: Competitor[] }>('/api/competitors?status=CONFIRMED'),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 60,
    retry: false,
  })

  const { data: keywordsRaw } = useQuery({
    queryKey: ['keywords', orgId],
    queryFn: () => apiClient.get<KeywordOpportunity[]>(`/api/orgs/${orgId}/keywords?limit=8`),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 60,
    retry: false,
  })

  const today = new Date()
  const fromDate = today.toISOString().split('T')[0]!
  const toDate = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]!
  const { data: calData } = useQuery({
    queryKey: ['cal-preview', orgId],
    queryFn: () => apiClient.get<{ posts: CalendarPost[] }>(`/api/calendar?from=${fromDate}&to=${toDate}`),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

  const researchMutation = useMutation({
    mutationFn: () => apiClient.post<{ success: boolean }>(`/api/orgs/${orgId}/research`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['intelligence', orgId] })
      void queryClient.invalidateQueries({ queryKey: ['competitors', orgId] })
      void queryClient.invalidateQueries({ queryKey: ['keywords', orgId] })
      void queryClient.invalidateQueries({ queryKey: ['metrics-overview', orgId] })
      toast.success('Research complete — all sections updated with fresh data')
    },
    onError: () => toast.error('Research failed. Check ANTHROPIC_API_KEY on Render.'),
  })

  const isLoading = intelLoading || metricsLoading || compLoading
  const platforms = overviewData?.overview ?? []
  const competitors = competitorData?.competitors ?? []
  const keywords = Array.isArray(keywordsRaw) ? (keywordsRaw as KeywordOpportunity[]) : []
  const posts = calData?.posts ?? []
  const score = intel?.presenceScore ?? 0
  const diagnosis = typeof (intel?.aiDiagnosis as Record<string, unknown> | null)?.['description'] === 'string'
    ? (intel!.aiDiagnosis as Record<string, unknown>)['description'] as string
    : ''
  const benchmarks = (intel?.aiDiagnosis as Record<string, unknown> | null)?.['benchmarks'] as
    { avgFollowers: number; avgEngagementRate: number; top10pctFollowers: number } | undefined
  const totalFollowers = platforms.reduce((s, p) => s + (p.latest?.followers ?? 0), 0)
  const hasEstimated = platforms.some((p) => p.isEstimated && p.latest)

  return (
    <div className="px-7 py-7 max-w-[1280px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Business Summary"
          description="AI-powered intelligence report — presence score, competitors, SEO, and content calendar"
          icon={<Brain className="h-5 w-5" />}
        />
        <Button variant="outline" size="sm" className="gap-2 shrink-0 mt-1"
          disabled={researchMutation.isPending} onClick={() => researchMutation.mutate()}>
          {researchMutation.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Researching…</>
            : <><RefreshCcw className="h-4 w-4" /> Refresh</>}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-28 gap-5">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-[var(--color-border)]" />
            <div className="absolute inset-0 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
            <Brain className="absolute inset-0 m-auto h-6 w-6 text-[var(--color-accent)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--color-text-2)]">Claude AI is researching your business…</p>
            <p className="text-xs text-[var(--color-text-4)] mt-1">Finding competitors, keywords, and calculating your presence score</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Estimated banner */}
          {hasEstimated && (
            <div className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-4 py-3 flex items-center gap-3">
              <Brain className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
              <p className="text-xs text-[var(--color-text-2)] flex-1">
                <span className="font-semibold text-[var(--color-accent)]">AI-estimated metrics</span> — Claude has generated baseline estimates from industry knowledge.
                Connect accounts via OAuth or configure Apify for live data.
              </p>
              <Link href="/settings" className="shrink-0">
                <Button variant="outline" size="sm" className="text-xs h-7">Connect accounts</Button>
              </Link>
            </div>
          )}

          {/* Row 1: Score + Org Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Presence Score */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col items-center gap-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-4)]">Digital Presence Score</p>
              <PresenceArc score={score} />
              {benchmarks && (
                <div className="w-full space-y-2 pt-3 border-t border-[var(--color-border)]">
                  {[
                    ['Industry avg followers', fmt(benchmarks.avgFollowers)],
                    ['Industry avg engagement', `${benchmarks.avgEngagementRate}%`],
                    ['Top 10% threshold', fmt(benchmarks.top10pctFollowers)],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-[11px]">
                      <span className="text-[var(--color-text-4)]">{label}</span>
                      <span className="font-semibold text-[var(--color-text)]">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Org Info */}
            <div className="lg:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-7 w-7 text-[var(--color-accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-[var(--color-text)] truncate">{activeOrg?.name}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {activeOrg?.industry && <Badge variant="outline" className="text-[10px]">{activeOrg.industry}</Badge>}
                    {(activeOrg as { city?: string } | null)?.city && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <MapPin className="h-2.5 w-2.5" />{(activeOrg as { city?: string }).city}
                      </Badge>
                    )}
                    {activeOrg?.activePlatforms?.map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                  </div>
                </div>
              </div>

              {diagnosis && <p className="text-sm text-[var(--color-text-2)] leading-relaxed">{diagnosis}</p>}

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--color-border)]">
                {[
                  { val: fmt(totalFollowers), label: 'Total followers' },
                  { val: String(competitors.length), label: 'Competitors' },
                  { val: String(keywords.length), label: 'SEO keywords' },
                ].map(({ val, label }) => (
                  <div key={label} className="text-center">
                    <p className="text-xl font-bold text-[var(--color-text)]">{val}</p>
                    <p className="text-[10px] text-[var(--color-text-4)]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Platform Cards */}
          {platforms.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-4)] mb-3">Social Platforms</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {platforms.map((p) => <PlatformCard key={p.platform} data={p} />)}
              </div>
            </section>
          )}

          {/* Row 3: Strengths / Issues / Quick Wins */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Strengths */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Award className="h-4 w-4 text-green-500" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">Strengths</h3>
              </div>
              <ul className="space-y-2.5">
                {(intel?.strengths ?? []).slice(0, 4).map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-2)]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
                {!intel?.strengths?.length && <li className="text-xs text-[var(--color-text-4)]">Click Refresh to analyse strengths</li>}
              </ul>
            </div>

            {/* Urgent Issues */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">Urgent Issues</h3>
              </div>
              <ul className="space-y-2.5">
                {(intel?.urgentIssues ?? []).slice(0, 4).map((item, i) => (
                  <li key={i}>
                    <Link href={item.actionLink ?? '#'}
                      className="flex items-start gap-2 text-xs text-[var(--color-text-2)] hover:text-[var(--color-accent)] transition-colors group">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>{item.issue}</span>
                      <ChevronRight className="h-3 w-3 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
                {!intel?.urgentIssues?.length && <li className="text-xs text-green-600">No urgent issues detected</li>}
              </ul>
            </div>

            {/* Quick Wins */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                  <Lightbulb className="h-4 w-4 text-[var(--color-accent)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">Quick Wins</h3>
              </div>
              <ul className="space-y-3">
                {(intel?.quickWins ?? []).slice(0, 3).map((item, i) => (
                  <li key={i} className="space-y-0.5">
                    <p className="text-xs font-medium text-[var(--color-text)]">{item.action}</p>
                    <p className="text-[10px] text-[var(--color-text-4)]">→ {item.impact}</p>
                  </li>
                ))}
                {!intel?.quickWins?.length && <li className="text-xs text-[var(--color-text-4)]">Click Refresh to get quick wins</li>}
              </ul>
            </div>
          </div>

          {/* Row 4: Competitors Table */}
          {competitors.length > 0 && (
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[var(--color-accent)]" />
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Competitor Landscape</h3>
                  <Badge variant="outline" className="text-[9px]">{competitors.length} tracked</Badge>
                </div>
                <Link href="/competitors">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">View all <ArrowRight className="h-3 w-3" /></Button>
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--color-surface-2)]">
                      {['Competitor', 'Platform', 'Followers', 'Engagement', 'Avg Likes'].map((h, i) => (
                        <th key={h} className={cn('py-2.5 font-semibold text-[var(--color-text-4)] uppercase tracking-wider text-[10px]', i === 0 ? 'text-left px-5' : i < 2 ? 'text-left px-4' : 'text-right px-4 last:px-5')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {competitors.slice(0, 8).map((c) => {
                      const cfg = PLATFORM_CFG[c.platform]
                      const Icon = cfg?.Icon
                      const m = c.latestMetrics
                      const myFollowers = platforms.find((p) => p.platform === c.platform)?.latest?.followers ?? 0
                      const theyLead = m && myFollowers > 0 && m.followers > myFollowers
                      return (
                        <tr key={c.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-4)]">
                                {(c.name || c.handle).slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-[var(--color-text)]">{c.name || c.handle}</p>
                                <p className="text-[10px] text-[var(--color-text-4)]">@{c.handle}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {Icon && cfg && (
                              <div className="flex items-center gap-1.5">
                                <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                                <span className="text-[var(--color-text-3)]">{cfg.label}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-semibold text-[var(--color-text)]">{m ? fmt(m.followers) : '—'}</span>
                              {theyLead && <TrendingUp className="h-3 w-3 text-red-400" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-text-2)]">{m ? `${m.engagementRate.toFixed(1)}%` : '—'}</td>
                          <td className="px-5 py-3 text-right text-[var(--color-text-2)]">{m ? fmt(m.avgLikes) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-2.5 text-[10px] text-[var(--color-text-4)] border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                AI-estimated competitor data. <Link href="/competitors" className="text-[var(--color-accent)] hover:underline">Review and confirm</Link> competitors to refine analysis.
              </p>
            </section>
          )}

          {/* Row 5: SEO Keywords + Upcoming Posts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* SEO */}
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--color-border)]">
                <Search className="h-4 w-4 text-[var(--color-accent)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text)]">SEO Opportunities</h3>
              </div>
              {keywords.length > 0 ? (
                <div className="divide-y divide-[var(--color-border)]">
                  {keywords.map((kw, i) => {
                    const d = diffLabel(kw.difficulty)
                    return (
                      <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-surface-2)] transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="h-5 w-5 rounded bg-[var(--color-surface-2)] flex items-center justify-center text-[9px] font-bold text-[var(--color-text-4)]">{i + 1}</span>
                          <p className="text-xs text-[var(--color-text)]">{kw.keyword}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-[var(--color-text-4)]">{fmt(kw.searchVolume)}/mo</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: d.color, background: `${d.color}18` }}>{d.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="px-5 py-8 flex flex-wrap gap-2">
                  {(intel?.detectedKeywords ?? []).map((kw, i) => (
                    <Badge key={i} variant="outline" className="text-[11px]">{kw}</Badge>
                  ))}
                  {!intel?.detectedKeywords?.length && (
                    <p className="text-xs text-[var(--color-text-4)]">Click Refresh to generate SEO keywords</p>
                  )}
                </div>
              )}
            </section>

            {/* Upcoming Calendar */}
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--color-accent)]" />
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Next 7 Days</h3>
                </div>
                <Link href="/studio/calendar">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">Calendar <ArrowRight className="h-3 w-3" /></Button>
                </Link>
              </div>
              {posts.length > 0 ? (
                <div className="divide-y divide-[var(--color-border)]">
                  {posts.slice(0, 7).map((post) => {
                    const cfg = PLATFORM_CFG[post.platform]
                    const Icon = cfg?.Icon
                    const d = new Date(post.date)
                    const dateStr = d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
                    return (
                      <div key={post.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-surface-2)] transition-colors">
                        {Icon && cfg && (
                          <div className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center" style={{ background: cfg.bg }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[var(--color-text)] truncate">{post.topic}</p>
                          <p className="text-[10px] text-[var(--color-text-4)]">{dateStr} · {post.format}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 gap-3 px-5 text-center">
                  <Calendar className="h-8 w-8 text-[var(--color-text-4)]" />
                  <p className="text-xs text-[var(--color-text-4)]">No posts scheduled for the next 7 days</p>
                  <Link href="/studio/calendar">
                    <Button size="sm" className="gap-1.5 text-xs h-7">
                      <Sparkles className="h-3.5 w-3.5" /> Generate calendar
                    </Button>
                  </Link>
                </div>
              )}
            </section>
          </div>

          {/* Bottom CTA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <BarChart3 className="h-5 w-5" />, title: 'Analytics', desc: 'Platform-specific metrics and trends', href: '/analytics/overview', color: '#6366F1' },
              { icon: <Sparkles className="h-5 w-5" />, title: 'AI Studio', desc: 'Generate posts, scripts, and blog content', href: '/studio/posts', color: '#EC4899' },
              { icon: <Target className="h-5 w-5" />, title: 'Competitors', desc: 'Track and analyse your competition', href: '/competitors', color: '#F59E0B' },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-3 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-2)] transition-all cursor-pointer group">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}18`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
                    <p className="text-[11px] text-[var(--color-text-4)]">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto text-[var(--color-text-4)] group-hover:text-[var(--color-accent)] transition-colors" />
                </div>
              </Link>
            ))}
          </div>

          {intel?.lastScannedAt && (
            <p className="text-center text-[10px] text-[var(--color-text-4)]">
              Last researched: {new Date(intel.lastScannedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
