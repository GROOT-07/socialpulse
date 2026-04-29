'use client'

/**
 * Organization Summary Page (/summary) — MODIFICATIONS_V2.md §2
 *
 * Sections:
 *   1. Business Identity Card + Presence Score gauge
 *   2. Social Media Presence Report (per-platform cards)
 *   3. SEO & Search Visibility Report
 *   4. Competitor Snapshot Table
 *   5. AI Diagnosis (Strengths / Urgent Issues / Quick Wins)
 *   6. 30-Day Roadmap Preview
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  RefreshCcw, Sparkles, ArrowRight, Instagram, Facebook, Youtube,
  Search, MessageCircle, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, Zap, Calendar, ExternalLink,
  Star, Globe, MapPin, Building2, Loader2, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { apiClient } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────

interface OrgIntelligence {
  presenceScore: number
  presenceScoreBreakdown: {
    socialFollowers: number
    socialEngagement: number
    seoKeywords: number
    googleProfile: number
    contentFreshness: number
    total: number
  } | null
  googleKgData: { description?: string; name?: string } | null
  googlePlacesData: {
    rating?: number
    userRatingsTotal?: number
    formattedAddress?: string
    openingHours?: string[] | null
  } | null
  detectedKeywords: string[]
  strengths: string[]
  urgentIssues: Array<{ issue: string; actionLink: string }> | null
  quickWins: Array<{ action: string; impact: string }> | null
  aiDiagnosis: { description?: string } | null
  lastScannedAt: string | null
}

interface PlaybookSummary {
  presenceScore: number
  diagnosis: { description?: string }
  strengths: string[]
  urgentIssues: Array<{ issue: string; actionLink: string }>
  quickWins: Array<{ action: string; impact: string }>
  roadmap: {
    weeks: Array<{
      week: number
      theme: string
      actions: Array<{ day: string; action: string; platform: string; type: string }>
    }>
  }
}

interface SocialAccount {
  id: string
  platform: string
  handle: string | null
  profileUrl: string | null
  metrics: Array<{
    followers: number
    engagementRate: number
    posts: number
    snapshotDate: string
  }>
}

interface Competitor {
  id: string
  businessName: string
  handle: string
  platform: string
  relevanceScore: number
  metrics: Array<{ followers: number; engagementRate: number }>
}

interface KeywordOpportunity {
  keyword: string
  searchVolume: number
  difficulty: number
  currentRank: number | null
  competitorDomain: string | null
  category: string
}

// ── Presence Score Gauge ──────────────────────────────────────

function PresenceGauge({ score }: { score: number }) {
  const angle = (score / 100) * 180 - 90 // -90 to +90 degrees
  const color = score < 40 ? 'var(--color-danger)' : score < 65 ? 'var(--color-warning)' : 'var(--color-success)'
  const label = score < 40 ? 'Weak' : score < 65 ? 'Developing' : 'Strong'

  // SVG arc path
  const r = 60
  const cx = 80
  const cy = 80
  const startAngle = Math.PI
  const endAngle = startAngle + (score / 100) * Math.PI
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const largeArc = score > 50 ? 1 : 0

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="100" viewBox="0 0 160 100">
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Fill */}
        {score > 0 && (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        )}
        {/* Center score */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--color-text)" fontFamily="var(--font-mono)">
          {score}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="var(--color-text-3)" fontFamily="var(--font-sans)">
          / 100
        </text>
      </svg>
      <div className="flex items-center gap-1.5 -mt-2">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold" style={{ color }}>{label}</span>
      </div>
      <p className="text-[10px] text-[var(--color-text-4)] mt-1">Online visibility score</p>
    </div>
  )
}

// ── Platform icon helper ──────────────────────────────────────

function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const props = { style: { width: size, height: size } }
  if (platform === 'INSTAGRAM') return <Instagram {...props} style={{ ...props.style, color: 'var(--platform-instagram)' }} />
  if (platform === 'FACEBOOK')  return <Facebook  {...props} style={{ ...props.style, color: 'var(--platform-facebook)' }} />
  if (platform === 'YOUTUBE')   return <Youtube   {...props} style={{ ...props.style, color: 'var(--platform-youtube)' }} />
  if (platform === 'WHATSAPP')  return <MessageCircle {...props} style={{ ...props.style, color: 'var(--platform-whatsapp)' }} />
  if (platform === 'GOOGLE')    return <Search    {...props} style={{ ...props.style, color: 'var(--platform-google)' }} />
  return <Globe {...props} style={{ ...props.style, color: 'var(--color-text-4)' }} />
}

function platformColor(platform: string): string {
  const map: Record<string, string> = {
    INSTAGRAM: 'var(--platform-instagram)',
    FACEBOOK: 'var(--platform-facebook)',
    YOUTUBE: 'var(--platform-youtube)',
    WHATSAPP: 'var(--platform-whatsapp)',
    GOOGLE: 'var(--platform-google)',
  }
  return map[platform] ?? 'var(--color-text-4)'
}

function completenessScore(account: SocialAccount): number {
  let score = 0
  if (account.handle) score += 30
  if (account.profileUrl) score += 20
  const m = account.metrics[0]
  if (m && m.followers > 0) score += 30
  if (m && m.posts > 0) score += 20
  return score
}

// ── Section 1: Business Identity Card ────────────────────────

function BusinessIdentitySection({ org, intelligence, onRescan }: {
  org: { name: string; industry: string; city: string | null; country: string | null; logoUrl: string | null; brandColor: string | null }
  intelligence: OrgIntelligence | null
  onRescan: () => void
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-start gap-6 flex-wrap">
        {/* Left: Org identity */}
        <div className="flex items-center gap-4 flex-1 min-w-60">
          <div
            className="h-16 w-16 rounded-xl flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ backgroundColor: org.brandColor ?? 'var(--color-accent)' }}
          >
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-full w-full rounded-xl object-cover" />
            ) : (
              org.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text)]">{org.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">{org.industry}</Badge>
              {org.city && (
                <span className="flex items-center gap-1 text-xs text-[var(--color-text-4)]">
                  <MapPin className="h-3 w-3" />
                  {org.city}{org.country ? `, ${org.country}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: AI description */}
        <div className="flex-1 min-w-60">
          {intelligence?.aiDiagnosis?.description ? (
            <p className="text-sm text-[var(--color-text-2)] leading-relaxed">
              {intelligence.aiDiagnosis.description}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-[var(--color-surface-2)] animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-[var(--color-surface-2)] animate-pulse" />
              <div className="h-3 w-3/5 rounded bg-[var(--color-surface-2)] animate-pulse" />
            </div>
          )}
        </div>

        {/* Right: Presence Score */}
        <div className="shrink-0">
          <PresenceGauge score={intelligence?.presenceScore ?? 0} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-border)]">
        <span className="text-xs text-[var(--color-text-4)]">
          Last updated:{' '}
          {intelligence?.lastScannedAt
            ? new Date(intelligence.lastScannedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Never scanned'}
        </span>
        <Button variant="outline" size="sm" onClick={onRescan} className="gap-1.5 h-7 text-xs">
          <RefreshCcw className="h-3.5 w-3.5" /> Re-scan
        </Button>
      </div>
    </div>
  )
}

// ── Section 2: Social Media Presence ─────────────────────────

function SocialPresenceSection({ accounts }: { accounts: SocialAccount[] }) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<Instagram className="h-10 w-10" />}
        title="No social accounts connected"
        description="Connect your Instagram, Facebook, or YouTube to see your presence score."
        action={<Link href="/settings/accounts"><Button size="sm">Connect accounts</Button></Link>}
      />
    )
  }

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-4)] mb-4">Social media presence</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acc) => {
          const metrics = acc.metrics[0]
          const completeness = completenessScore(acc)
          const verdict = completeness >= 80 ? 'Strong' : completeness >= 50 ? 'Needs Work' : 'Weak'
          const verdictColor = completeness >= 80 ? 'var(--color-success)' : completeness >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'

          return (
            <div key={acc.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={acc.platform} size={18} />
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {acc.platform.charAt(0) + acc.platform.slice(1).toLowerCase()}
                  </span>
                </div>
                <div
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: `${verdictColor}1A`, color: verdictColor }}
                >
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: verdictColor }} />
                  {verdict}
                </div>
              </div>

              {acc.handle && (
                <p className="text-xs text-[var(--color-text-4)]">@{acc.handle}</p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-[var(--color-text-4)] uppercase tracking-wide">Followers</p>
                  <p className="text-base font-bold text-[var(--color-text)] font-mono">
                    {metrics ? metrics.followers.toLocaleString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--color-text-4)] uppercase tracking-wide">Engagement</p>
                  <p className="text-base font-bold text-[var(--color-text)] font-mono">
                    {metrics ? `${metrics.engagementRate.toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Profile completeness bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[var(--color-text-4)]">Profile completeness</span>
                  <span className="text-[10px] font-semibold text-[var(--color-text-3)]">{completeness}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${completeness}%`, backgroundColor: verdictColor }}
                  />
                </div>
              </div>

              <Link
                href={`/analytics/${acc.platform.toLowerCase()}`}
                className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
              >
                View full analytics <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Section 3: SEO & Search Visibility ────────────────────────

function SEOSection({ intelligence, keywords }: {
  intelligence: OrgIntelligence | null
  keywords: KeywordOpportunity[]
}) {
  const rankingKeywords = keywords.filter((k) => k.currentRank !== null && k.currentRank <= 10)
  const opportunityKeywords = keywords.filter((k) => k.currentRank === null || k.currentRank > 20)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Google presence */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-[var(--color-text-3)]" />
          <h4 className="text-sm font-semibold text-[var(--color-text)]">How you appear on Google</h4>
        </div>

        <div className="space-y-3">
          {intelligence?.googlePlacesData?.rating ? (
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-[var(--color-warning)]" />
              <span className="text-sm font-semibold text-[var(--color-text)]">
                {intelligence.googlePlacesData.rating.toFixed(1)}
              </span>
              <span className="text-xs text-[var(--color-text-3)]">
                ({intelligence.googlePlacesData.userRatingsTotal?.toLocaleString()} reviews)
              </span>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-4)]">Google Business Profile not claimed</p>
          )}

          {intelligence?.googlePlacesData?.formattedAddress && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-[var(--color-text-4)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--color-text-2)]">{intelligence.googlePlacesData.formattedAddress}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
            <span className="text-sm text-[var(--color-text-2)]">
              {rankingKeywords.length} keywords ranking in top 10
            </span>
          </div>

          {(intelligence?.detectedKeywords?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-4)] mb-2">You rank for</p>
              <div className="flex flex-wrap gap-1.5">
                {intelligence!.detectedKeywords.slice(0, 5).map((kw) => (
                  <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyword Opportunities */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--color-text-3)]" />
            <h4 className="text-sm font-semibold text-[var(--color-text)]">Keyword opportunities</h4>
          </div>
          <Link href="/studio/seo">
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
              View all <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {opportunityKeywords.length === 0 ? (
          <p className="text-sm text-[var(--color-text-4)]">Running keyword analysis...</p>
        ) : (
          <div className="space-y-2">
            {opportunityKeywords.slice(0, 5).map((kw) => (
              <div key={kw.keyword} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text)] truncate">{kw.keyword}</p>
                  <p className="text-[10px] text-[var(--color-text-4)]">
                    ~{kw.searchVolume.toLocaleString()} searches/mo · Difficulty: {kw.difficulty}/100
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] shrink-0 ml-2', kw.category === 'QUICK_WIN' && 'text-[var(--color-success)] border-[var(--color-success)]')}
                >
                  {kw.category === 'QUICK_WIN' ? '⚡ Quick win' : kw.category.toLowerCase().replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section 4: Competitor Snapshot Table ──────────────────────

function CompetitorSnapshotSection({ orgName, orgMetrics, competitors }: {
  orgName: string
  orgMetrics: { followers: number; engagementRate: number } | null
  competitors: Competitor[]
}) {
  if (competitors.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No competitors tracked yet"
          description="Competitor discovery is running. Check back in a few minutes."
          action={<Link href="/competitors"><Button size="sm" variant="outline">View competitors</Button></Link>}
        />
      </div>
    )
  }

  const allRows = [
    { name: orgName, followers: orgMetrics?.followers ?? 0, engagementRate: orgMetrics?.engagementRate ?? 0, isOrg: true },
    ...competitors.map((c) => ({
      name: c.businessName,
      followers: c.metrics[0]?.followers ?? 0,
      engagementRate: c.metrics[0]?.engagementRate ?? 0,
      isOrg: false,
    })),
  ]

  const maxFollowers = Math.max(...allRows.map((r) => r.followers))
  const orgFollowers = orgMetrics?.followers ?? 0
  const orgEngagement = orgMetrics?.engagementRate ?? 0

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-3)]">
          Competitor snapshot
        </h3>
        <Link href="/competitors">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            Full analysis <ChevronRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-3)]">Organization</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-3)]">Followers</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-3)]">Engagement</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-3)]">vs You</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {allRows.map((row) => {
              const followersDiff = row.isOrg ? 0 : row.followers - orgFollowers
              const engagementDiff = row.isOrg ? 0 : row.engagementRate - orgEngagement
              const isAhead = !row.isOrg && (followersDiff > 0 || engagementDiff > 0.5)

              return (
                <tr
                  key={row.name}
                  className={cn(
                    'transition-colors hover:bg-[var(--color-surface-2)]',
                    row.isOrg && 'bg-[var(--color-accent-light)]',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-7 w-7 rounded shrink-0 flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: row.isOrg ? 'var(--color-accent)' : 'var(--color-text-4)' }}
                      >
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-[var(--color-text)]">{row.name}</span>
                        {row.isOrg && <span className="ml-1.5 text-[10px] text-[var(--color-accent-text)] font-semibold">YOU</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono text-[var(--color-text-2)]">
                      {row.followers > 0 ? row.followers.toLocaleString() : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono text-[var(--color-text-2)]">
                      {row.engagementRate > 0 ? `${row.engagementRate.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.isOrg ? (
                      <span className="text-[10px] text-[var(--color-text-4)]">baseline</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        {isAhead ? (
                          <><TrendingUp className="h-3.5 w-3.5 text-[var(--color-danger)]" /><span className="text-xs text-[var(--color-danger)]">Ahead</span></>
                        ) : (
                          <><TrendingDown className="h-3.5 w-3.5 text-[var(--color-success)]" /><span className="text-xs text-[var(--color-success)]">Behind</span></>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section 5: AI Diagnosis ───────────────────────────────────

function AIDiagnosisSection({ intelligence, onRegenerate, isRegenerating }: {
  intelligence: OrgIntelligence | null
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const strengths = intelligence?.strengths ?? []
  const urgentIssues = intelligence?.urgentIssues ?? []
  const quickWins = intelligence?.quickWins ?? []

  if (!intelligence) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-accent)]" />
        <p className="text-sm text-[var(--color-text-3)]">Generating your AI diagnosis...</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-3)]">AI diagnosis — where you stand</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={isRegenerating} className="h-7 text-xs gap-1.5">
          {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          Regenerate
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-border)]">
        {/* Strengths */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-full bg-[var(--color-success-light)] flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--color-text)]">Your strengths</span>
          </div>
          <ul className="space-y-2">
            {strengths.length > 0 ? strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-2)]">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
                {s}
              </li>
            )) : <p className="text-sm text-[var(--color-text-4)]">Analysis in progress...</p>}
          </ul>
        </div>

        {/* Urgent Issues */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-full bg-[var(--color-danger-light)] flex items-center justify-center">
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-danger)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--color-text)]">Urgent issues</span>
          </div>
          <ul className="space-y-2.5">
            {urgentIssues.length > 0 ? urgentIssues.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--color-danger)] shrink-0" />
                  <span className="text-sm text-[var(--color-text-2)]">{item.issue}</span>
                </div>
                {item.actionLink && (
                  <Link href={item.actionLink} className="text-[10px] text-[var(--color-accent)] whitespace-nowrap hover:underline shrink-0">
                    Fix →
                  </Link>
                )}
              </li>
            )) : <p className="text-sm text-[var(--color-text-4)]">No critical issues found!</p>}
          </ul>
        </div>

        {/* Quick Wins */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-full bg-[var(--color-warning-light)] flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-[var(--color-warning)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--color-text)]">Quick wins</span>
          </div>
          <ul className="space-y-2.5">
            {quickWins.length > 0 ? quickWins.map((item, i) => (
              <li key={i} className="space-y-0.5">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--color-warning)] shrink-0" />
                  <span className="text-sm text-[var(--color-text-2)]">{item.action}</span>
                </div>
                {item.impact && (
                  <p className="text-[10px] text-[var(--color-success)] ml-3.5">{item.impact}</p>
                )}
              </li>
            )) : <p className="text-sm text-[var(--color-text-4)]">Calculating quick wins...</p>}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Section 6: 30-Day Roadmap Preview ────────────────────────

function RoadmapSection({ playbookSummary }: { playbookSummary: PlaybookSummary | null }) {
  const weeks = playbookSummary?.roadmap?.weeks ?? []

  if (weeks.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--color-text-3)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">30-day roadmap</h3>
          </div>
        </div>
        <EmptyState
          icon={<Calendar className="h-8 w-8" />}
          title="Building your roadmap"
          description="Your 30-day action plan is being generated. Check back in a few minutes."
          action={<Link href="/studio/calendar"><Button size="sm" variant="outline">View calendar</Button></Link>}
        />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--color-text-3)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text)]">30-day roadmap preview</h3>
        </div>
        <Link href="/studio/calendar">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            View full calendar <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {weeks.slice(0, 4).map((week) => (
          <div key={week.week} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)] mb-1">Week {week.week}</p>
            <p className="text-xs font-semibold text-[var(--color-text)] mb-2">{week.theme}</p>
            <ul className="space-y-1.5">
              {week.actions.slice(0, 3).map((action, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-[var(--color-text-4)] shrink-0" />
                  <span className="text-[11px] text-[var(--color-text-3)]">{action.action}</span>
                </li>
              ))}
              {week.actions.length > 3 && (
                <li className="text-[10px] text-[var(--color-text-4)]">+{week.actions.length - 3} more</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function SummaryPage() {
  const { activeOrg } = useOrgStore()
  const queryClient = useQueryClient()
  const orgId = activeOrg?.id ?? ''

  const { data: intelligence, isLoading: intelLoading } = useQuery({
    queryKey: ['org-intelligence', orgId],
    queryFn: () => apiClient.get<OrgIntelligence>(`/api/orgs/${orgId}/intelligence`),
    enabled: !!orgId,
    refetchInterval: (query) => (query.state.data ? false : 5000),
  })

  const { data: playbookData } = useQuery({
    queryKey: ['playbook-summary', orgId],
    queryFn: () => apiClient.get<{ content: PlaybookSummary }>(`/api/orgs/${orgId}/playbook/summary`),
    enabled: !!orgId,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['social-accounts-summary', orgId],
    queryFn: () => apiClient.get<SocialAccount[]>(`/api/orgs/${orgId}/accounts/summary`),
    enabled: !!orgId,
  })

  const { data: competitors = [] } = useQuery({
    queryKey: ['competitors-summary', orgId],
    queryFn: () => apiClient.get<Competitor[]>(`/api/orgs/${orgId}/competitors?format=discovery&status=CONFIRMED`),
    enabled: !!orgId,
  })

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords-summary', orgId],
    queryFn: () => apiClient.get<KeywordOpportunity[]>(`/api/orgs/${orgId}/keywords?limit=10`),
    enabled: !!orgId,
  })

  const rescanMutation = useMutation({
    mutationFn: () => apiClient.post(`/api/orgs/${orgId}/jobs/intelligence`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-intelligence', orgId] })
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: () => apiClient.post(`/api/orgs/${orgId}/jobs/org-summary`),
    onSuccess: () => {
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['org-intelligence', orgId] })
        void queryClient.invalidateQueries({ queryKey: ['playbook-summary', orgId] })
      }, 5000)
    },
  })

  // Aggregate org metrics from social accounts
  const orgMetrics = accounts.length > 0
    ? {
        followers: accounts.reduce((sum, a) => sum + (a.metrics[0]?.followers ?? 0), 0),
        engagementRate:
          accounts.reduce((sum, a) => sum + (a.metrics[0]?.engagementRate ?? 0), 0) /
          Math.max(1, accounts.length),
      }
    : null

  if (!orgId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text-3)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-7 py-7 max-w-[1280px] mx-auto">
      <PageHeader
        title="Organization summary"
        description={`A full snapshot of ${activeOrg?.name ?? 'your organization'}'s online presence.`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => rescanMutation.mutate()}
            disabled={rescanMutation.isPending}
            className="gap-1.5"
          >
            {rescanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Re-scan
          </Button>
        }
      />

      {/* Section 1: Business Identity */}
      {activeOrg && (
        <BusinessIdentitySection
          org={activeOrg}
          intelligence={intelligence ?? null}
          onRescan={() => rescanMutation.mutate()}
        />
      )}

      {/* Section 2: Social Media Presence */}
      <div>
        <SocialPresenceSection accounts={accounts} />
      </div>

      {/* Section 3: SEO & Search */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-4)] mb-4">SEO & search visibility</h3>
        <SEOSection intelligence={intelligence ?? null} keywords={keywords} />
      </div>

      {/* Section 4: Competitor Snapshot */}
      <CompetitorSnapshotSection
        orgName={activeOrg?.name ?? ''}
        orgMetrics={orgMetrics}
        competitors={competitors}
      />

      {/* Section 5: AI Diagnosis */}
      <AIDiagnosisSection
        intelligence={intelligence ?? null}
        onRegenerate={() => regenerateMutation.mutate()}
        isRegenerating={regenerateMutation.isPending}
      />

      {/* Section 6: 30-Day Roadmap */}
      <RoadmapSection playbookSummary={playbookData?.content ?? null} />
    </div>
  )
}
