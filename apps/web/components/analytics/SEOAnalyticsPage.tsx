'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, TrendingUp, TrendingDown, Minus, ArrowUpRight,
  Globe, Star, BarChart2, Lightbulb, ExternalLink, RefreshCw,
} from 'lucide-react'
import { request } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────

interface KeywordRanking {
  keyword: string
  currentRank: number | null
  previousRank: number | null
  searchVolume: number
  difficulty: number
  category: 'QUICK_WIN' | 'MEDIUM' | 'LONG_TERM' | 'LOCAL'
  contentCreated: boolean
}

interface SEOSummary {
  presenceScore: number
  organicKeywords: number
  avgPosition: number | null
  top3Keywords: number
  top10Keywords: number
  opportunities: number
  googleBusinessClaimed: boolean
  googleRating: number | null
  googleReviews: number | null
}

// ── Rank delta indicator ──────────────────────────────────────

function RankDelta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null) return <span className="text-xs text-[var(--color-text-4)]">Not ranking</span>
  if (previous === null) return (
    <span className="text-xs font-mono text-[var(--color-text)]">#{current}</span>
  )
  const delta = previous - current // positive = improved
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-mono text-[var(--color-text)]">#{current}</span>
      {delta > 0 ? (
        <span className="flex items-center text-[10px] text-success">
          <TrendingUp className="h-3 w-3" /> +{delta}
        </span>
      ) : delta < 0 ? (
        <span className="flex items-center text-[10px] text-danger">
          <TrendingDown className="h-3 w-3" /> {delta}
        </span>
      ) : (
        <span className="flex items-center text-[10px] text-[var(--color-text-4)]">
          <Minus className="h-3 w-3" />
        </span>
      )}
    </div>
  )
}

// ── Difficulty badge ──────────────────────────────────────────

function DifficultyBadge({ score }: { score: number }) {
  const { label, className } =
    score >= 70
      ? { label: 'Hard', className: 'bg-danger/10 text-danger border-danger/20' }
      : score >= 40
      ? { label: 'Medium', className: 'bg-warning/10 text-warning border-warning/20' }
      : { label: 'Easy', className: 'bg-success/10 text-success border-success/20' }
  return (
    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${className}`}>
      {label}
    </Badge>
  )
}

// ── Category badge ────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, string> = {
    QUICK_WIN: 'bg-success/10 text-success border-success/20',
    MEDIUM: 'bg-accent-light text-accent border-accent/20',
    LONG_TERM: 'bg-surface-2 text-[var(--color-text-3)] border-brand-border',
    LOCAL: 'bg-warning/10 text-warning border-warning/20',
  }
  const labels: Record<string, string> = {
    QUICK_WIN: '⚡ Quick Win',
    MEDIUM: 'Medium',
    LONG_TERM: 'Long-term',
    LOCAL: '📍 Local',
  }
  return (
    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${map[category] ?? ''}`}>
      {labels[category] ?? category}
    </Badge>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function SEOAnalyticsPage(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'rankings' | 'opportunities'>('rankings')

  const { data: summaryData, isLoading: summaryLoading, refetch } = useQuery({
    queryKey: ['seo-summary'],
    queryFn: () => request<{ summary: SEOSummary | null }>('/api/metrics/seo/summary'),
    retry: false,
  })

  const { data: keywordsData, isLoading: kwLoading } = useQuery({
    queryKey: ['seo-keywords', activeTab],
    queryFn: () =>
      request<{ keywords: KeywordRanking[] }>(
        `/api/metrics/seo/keywords?type=${activeTab === 'opportunities' ? 'opportunity' : 'ranking'}`,
      ),
    retry: false,
  })

  const summary = summaryData?.summary ?? null
  const keywords = keywordsData?.keywords ?? []
  const isLoading = summaryLoading || kwLoading

  const hasData = summary !== null

  return (
    <>
      <PageHeader
        title="Search & SEO Analytics"
        description="Keyword rankings, Google visibility, and search opportunities for your business."
        actions={
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()} aria-label="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />

      {!hasData && !summaryLoading ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<Search className="h-12 w-12" />}
                heading="SEO data not available yet"
                description="Complete onboarding to trigger keyword discovery, or visit the SEO Planner in Content Studio for full SEO tools."
                action={{ label: 'Go to SEO Planner', href: '/studio/seo' }}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 mb-6">
            {[
              {
                label: 'Presence Score',
                value: summary?.presenceScore ?? 0,
                suffix: '/100',
                icon: Globe,
                color: 'text-accent',
              },
              {
                label: 'Ranking Keywords',
                value: summary?.organicKeywords ?? 0,
                icon: BarChart2,
              },
              {
                label: 'Avg. Position',
                value: summary?.avgPosition != null ? `#${summary.avgPosition.toFixed(0)}` : '—',
                icon: TrendingUp,
                raw: true,
              },
              {
                label: 'Top 3 Keywords',
                value: summary?.top3Keywords ?? 0,
                icon: Star,
                color: 'text-success',
              },
              {
                label: 'Top 10 Keywords',
                value: summary?.top10Keywords ?? 0,
                icon: TrendingUp,
              },
              {
                label: 'Opportunities',
                value: summary?.opportunities ?? 0,
                icon: Lightbulb,
                color: 'text-warning',
              },
            ].map(({ label, value, icon: Icon, color, suffix, raw }) => (
              <Card key={label} className="bg-surface-2">
                <CardContent className="p-3">
                  <Icon className={`h-4 w-4 mb-2 ${color ?? 'text-[var(--color-text-4)]'}`} />
                  <p className="font-bold font-mono text-lg text-[var(--color-text)]">
                    {raw ? value : typeof value === 'number' ? value.toLocaleString() : value}
                    {suffix && <span className="text-xs text-[var(--color-text-4)]">{suffix}</span>}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">
                    {label}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Google Business card */}
          {summary && (
            <Card className="mb-4">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4285f420] text-[#4285f4]">
                  <Globe className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Google Business Profile</p>
                  <p className="text-xs text-[var(--color-text-4)]">
                    {summary.googleBusinessClaimed ? 'Profile claimed' : 'Profile not yet claimed'}
                    {summary.googleRating != null && ` · ⭐ ${summary.googleRating.toFixed(1)}`}
                    {summary.googleReviews != null && ` · ${summary.googleReviews} reviews`}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={summary.googleBusinessClaimed
                    ? 'bg-success/10 text-success border-success/20 text-xs'
                    : 'bg-warning/10 text-warning border-warning/20 text-xs'}
                >
                  {summary.googleBusinessClaimed ? '✓ Claimed' : '! Unclaimed'}
                </Badge>
                <Link href="/studio/seo">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    Optimize <ArrowUpRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Tabs: rankings | opportunities */}
          <div className="mb-4 flex gap-1 rounded-lg border border-brand-border bg-surface-2 p-0.5 w-fit">
            {[
              { key: 'rankings' as const, label: 'Current Rankings' },
              { key: 'opportunities' as const, label: 'Opportunities' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === t.key
                    ? 'bg-surface text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-4)] hover:text-[var(--color-text-2)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Keywords table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {activeTab === 'rankings' ? (
                  <><BarChart2 className="h-4 w-4" /> Your Keyword Rankings</>
                ) : (
                  <><Lightbulb className="h-4 w-4 text-warning" /> Keyword Opportunities</>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-10 w-full rounded" />
                  ))}
                </div>
              ) : keywords.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-8 w-8" />}
                  heading={activeTab === 'rankings' ? 'No ranking data yet' : 'No opportunities found yet'}
                  description="Keyword data will appear after the SEO discovery job runs post-onboarding."
                  action={{ label: 'Go to SEO Planner', href: '/studio/seo' }}
                />
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-brand-border">
                        {['Keyword', 'Rank', 'Volume', 'Difficulty', 'Category', ''].map((h) => (
                          <th key={h} className="pb-2 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map((kw, i) => (
                        <tr
                          key={`${kw.keyword}-${i}`}
                          className="border-b border-brand-border last:border-0 hover:bg-surface-2"
                        >
                          <td className="py-2.5 px-2">
                            <p className="font-medium text-[var(--color-text)]">{kw.keyword}</p>
                          </td>
                          <td className="py-2.5 px-2">
                            <RankDelta current={kw.currentRank} previous={kw.previousRank} />
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[var(--color-text-3)]">
                            {kw.searchVolume > 0 ? kw.searchVolume.toLocaleString() : '—'}
                          </td>
                          <td className="py-2.5 px-2">
                            <DifficultyBadge score={kw.difficulty} />
                          </td>
                          <td className="py-2.5 px-2">
                            <CategoryBadge category={kw.category} />
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            {activeTab === 'opportunities' && !kw.contentCreated && (
                              <Link href={`/studio/blog?keyword=${encodeURIComponent(kw.keyword)}`}>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-accent hover:text-accent">
                                  Create content <ExternalLink className="h-2.5 w-2.5" />
                                </Button>
                              </Link>
                            )}
                            {kw.contentCreated && (
                              <Badge variant="outline" className="text-[10px] h-5 bg-success/10 text-success border-success/20">
                                ✓ Content created
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CTA to full SEO planner */}
          <div className="mt-4 flex items-center justify-between rounded-lg border border-brand-border bg-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">Want the full SEO toolkit?</p>
              <p className="text-xs text-[var(--color-text-4)]">
                Content gap analysis, backlink opportunities, Google Business optimization and more.
              </p>
            </div>
            <Link href="/studio/seo">
              <Button size="sm" className="gap-1.5">
                Open SEO Planner <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </>
      )}
    </>
  )
}
