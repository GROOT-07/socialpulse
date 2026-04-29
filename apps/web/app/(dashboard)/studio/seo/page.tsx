'use client'

import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Search, TrendingUp, TrendingDown, Minus, ArrowRight,
  ExternalLink, Loader2, Sparkles, Target, BarChart2,
  Globe, CheckCircle2, AlertTriangle, MapPin, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────

interface KeywordOpportunity {
  id: string
  keyword: string
  searchVolume: number
  difficulty: number
  currentRank: number | null
  competitorDomain: string | null
  competitorRank: number | null
  category: string
  contentCreated: boolean
  updatedAt: string
}

interface OrgIntelligence {
  presenceScore: number
  googlePlacesData: {
    rating?: number
    userRatingsTotal?: number
    formattedAddress?: string
  } | null
  detectedKeywords: string[]
}

interface SEOBrief {
  keyword: string
  searchIntent: string
  contentType: string
  titleOptions: string[]
  outline: Array<{ heading: string; notes: string }>
  estimatedWordCount: number
  targetFeaturedSnippet: boolean
}

// ── Tab ───────────────────────────────────────────────────────

type Tab = 'your-keywords' | 'opportunities' | 'local' | 'gbp'

// ── Difficulty badge ──────────────────────────────────────────

function DifficultyBadge({ value }: { value: number }) {
  const color = value <= 30 ? 'var(--color-success)' : value <= 60 ? 'var(--color-warning)' : 'var(--color-danger)'
  const label = value <= 30 ? 'Easy' : value <= 60 ? 'Medium' : 'Hard'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {label} {value}
    </span>
  )
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-xs text-[var(--color-text-4)]">Not ranking</span>
  const color = rank <= 3 ? 'var(--color-success)' : rank <= 10 ? 'var(--color-warning)' : 'var(--color-text-3)'
  return <span className="text-xs font-mono font-semibold" style={{ color }}>#{rank}</span>
}

// ── Keyword row ───────────────────────────────────────────────

function KeywordRow({
  kw,
  onBrief,
}: {
  kw: KeywordOpportunity
  onBrief: (keyword: string) => void
}) {
  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors">
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-[var(--color-text-2)]">{kw.keyword}</p>
        {kw.competitorDomain && (
          <p className="text-[10px] text-[var(--color-text-4)] mt-0.5">Competitor: {kw.competitorDomain}</p>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-[var(--color-text-3)] font-mono">
        {kw.searchVolume > 0 ? `${(kw.searchVolume / 1000).toFixed(1)}K` : '—'}
      </td>
      <td className="py-3 px-4"><DifficultyBadge value={kw.difficulty} /></td>
      <td className="py-3 px-4"><RankBadge rank={kw.currentRank} /></td>
      <td className="py-3 px-4">
        <Badge variant="secondary" className="text-[10px] capitalize">
          {kw.category.toLowerCase().replace(/_/g, ' ')}
        </Badge>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {!kw.contentCreated && (
            <button
              onClick={() => onBrief(kw.keyword)}
              className="flex items-center gap-1 rounded-full border border-[var(--color-accent)] px-2 py-0.5 text-[10px] text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors"
            >
              <FileText className="h-2.5 w-2.5" /> SEO Brief
            </button>
          )}
          <Link
            href={`/studio/blog?topic=${encodeURIComponent(kw.keyword)}`}
            className="flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
          >
            Write <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      </td>
    </tr>
  )
}

// ── SEO Brief Modal ───────────────────────────────────────────

function SEOBriefPanel({ brief, onClose }: { brief: SEOBrief; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[var(--color-text)]">SEO Brief: {brief.keyword}</h2>
          <button onClick={onClose} className="text-[var(--color-text-4)] hover:text-[var(--color-text-2)]">✕</button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Search intent', value: brief.searchIntent },
            { label: 'Content type', value: brief.contentType },
            { label: 'Target words', value: `${brief.estimatedWordCount.toLocaleString()}+` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-[var(--color-surface-2)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-4)]">{item.label}</p>
              <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5 capitalize">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-2">Title options</p>
          <div className="space-y-1.5">
            {brief.titleOptions.map((t, i) => (
              <div key={i} className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-2)]">{t}</div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-2">Content outline</p>
          <div className="space-y-1.5">
            {brief.outline.map((s, i) => (
              <div key={i} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
                <p className="text-sm font-medium text-[var(--color-text)]">{s.heading}</p>
                {s.notes && <p className="text-xs text-[var(--color-text-4)] mt-0.5">{s.notes}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1 gap-2" asChild>
            <Link href={`/studio/blog?topic=${encodeURIComponent(brief.keyword)}`}>
              <FileText className="h-4 w-4" /> Write this article
            </Link>
          </Button>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function SEOPlannerPage() {
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''

  const [tab, setTab] = useState<Tab>('opportunities')
  const [briefKeyword, setBriefKeyword] = useState<string | null>(null)

  const { data: keywords = [], isLoading: kwLoading } = useQuery({
    queryKey: ['keywords-all', orgId],
    queryFn: () => apiClient.get<KeywordOpportunity[]>(`/api/orgs/${orgId}/keywords?limit=50`),
    enabled: !!orgId,
  })

  const { data: intelligence } = useQuery({
    queryKey: ['org-intelligence', orgId],
    queryFn: () => apiClient.get<OrgIntelligence>(`/api/orgs/${orgId}/intelligence`),
    enabled: !!orgId,
  })

  const briefMutation = useMutation({
    mutationFn: (keyword: string) =>
      apiClient.post<{ brief: SEOBrief }>('/api/ai/seo-brief', { keyword }),
    onError: () => toast.error('Failed to generate SEO brief.'),
  })

  function handleBrief(keyword: string) {
    setBriefKeyword(keyword)
    briefMutation.mutate(keyword)
  }

  const TABS = [
    { id: 'your-keywords' as Tab, label: 'Your keywords' },
    { id: 'opportunities' as Tab, label: 'Opportunities' },
    { id: 'local' as Tab, label: 'Local keywords' },
    { id: 'gbp' as Tab, label: 'Google Business' },
  ]

  const filterKeywords = (t: Tab) => {
    if (t === 'your-keywords') return keywords.filter((k) => k.currentRank !== null)
    if (t === 'opportunities') return keywords.filter((k) => k.currentRank === null || k.currentRank > 20)
    if (t === 'local') return keywords.filter((k) => k.category === 'LOCAL')
    return keywords
  }

  const displayKeywords = filterKeywords(tab)

  return (
    <div className="px-7 py-7 max-w-[1280px] mx-auto">
      <PageHeader
        title="SEO Content Planner"
        description="Keyword intelligence, content gaps, and local SEO strategy in one place"
        icon={<Search className="h-5 w-5" />}
      />

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        {[
          { label: 'Total keywords tracked', value: keywords.length, icon: Target },
          { label: 'Ranking (Top 10)', value: keywords.filter((k) => k.currentRank !== null && k.currentRank <= 10).length, icon: TrendingUp },
          { label: 'Quick wins', value: keywords.filter((k) => k.category === 'QUICK_WIN').length, icon: CheckCircle2 },
          { label: 'Local keywords', value: keywords.filter((k) => k.category === 'LOCAL').length, icon: MapPin },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-[var(--color-text-4)]" />
                <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-4)]">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold font-mono text-[var(--color-text)]">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--color-surface-2)] p-1 w-fit mb-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm transition-colors',
              tab === t.id
                ? 'bg-[var(--color-surface)] font-semibold text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-3)] hover:text-[var(--color-text-2)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* GBP tab */}
      {tab === 'gbp' && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4">Google Business Profile</h3>
          {intelligence?.googlePlacesData ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-[var(--color-surface-2)] p-4 space-y-3">
                {intelligence.googlePlacesData.rating && (
                  <div>
                    <p className="text-xs text-[var(--color-text-4)]">Rating</p>
                    <p className="text-xl font-bold font-mono text-[var(--color-text)]">
                      ⭐ {intelligence.googlePlacesData.rating} ({intelligence.googlePlacesData.userRatingsTotal} reviews)
                    </p>
                  </div>
                )}
                {intelligence.googlePlacesData.formattedAddress && (
                  <div>
                    <p className="text-xs text-[var(--color-text-4)]">Address</p>
                    <p className="text-sm text-[var(--color-text-2)]">{intelligence.googlePlacesData.formattedAddress}</p>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-[var(--color-success-light)] p-4">
                <p className="text-xs font-semibold text-[var(--color-success-text)] uppercase tracking-wide mb-2">GBP status</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" />
                  <p className="text-sm font-semibold text-[var(--color-success-text)]">Profile found on Google</p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Globe className="h-10 w-10" />}
              title="Google Business Profile not found"
              description="Run the organization intelligence scan to discover your Google presence."
            />
          )}
        </div>
      )}

      {/* Keyword tabs */}
      {tab !== 'gbp' && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          {kwLoading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 rounded bg-[var(--color-surface-2)] animate-pulse" />
              ))}
            </div>
          ) : displayKeywords.length === 0 ? (
            <EmptyState
              icon={<Search className="h-10 w-10" />}
              title="No keywords found"
              description="Run the SEO keyword discovery job to populate your keyword opportunities."
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  {['Keyword', 'Volume', 'Difficulty', 'Your rank', 'Category', 'Actions'].map((h) => (
                    <th key={h} className="py-3 px-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-4)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayKeywords.slice(0, 30).map((kw) => (
                  <KeywordRow key={kw.id} kw={kw} onBrief={handleBrief} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* SEO Brief modal */}
      {briefKeyword && (
        <div>
          {briefMutation.isPending && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)] mx-auto mb-3" />
                <p className="text-sm font-medium text-[var(--color-text-2)]">Generating SEO brief for "{briefKeyword}"...</p>
              </div>
            </div>
          )}
          {briefMutation.data && !briefMutation.isPending && (
            <SEOBriefPanel
              brief={briefMutation.data.brief}
              onClose={() => { setBriefKeyword(null); briefMutation.reset() }}
            />
          )}
        </div>
      )}
    </div>
  )
}
