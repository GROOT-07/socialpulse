'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Star, RefreshCw, Loader2, Globe, ThumbsUp, ThumbsDown,
  Minus, MessageSquare, TrendingUp, Shield, ExternalLink,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { reputationApi, type ReputationReport, type ReviewItem } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { useOrgStore } from '@/store/org.store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Star Rating ───────────────────────────────────────────────

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={sz}
          fill={i <= Math.round(rating) ? '#f59e0b' : 'none'}
          stroke={i <= Math.round(rating) ? '#f59e0b' : 'var(--color-border-2)'}
        />
      ))}
    </div>
  )
}

// ── Sentiment Badge ───────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: ReviewItem['sentiment'] }) {
  const config = {
    positive: { icon: ThumbsUp, label: 'Positive', color: 'var(--color-success-text)', bg: 'var(--color-success-light)' },
    neutral:  { icon: Minus,    label: 'Neutral',  color: 'var(--color-text-3)',        bg: 'var(--color-surface-2)' },
    negative: { icon: ThumbsDown, label: 'Negative', color: 'var(--color-danger)',       bg: 'var(--color-danger-light)' },
  }
  const { icon: Icon, label, color, bg } = config[sentiment]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color, backgroundColor: bg }}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

// ── Rating Distribution Bar ───────────────────────────────────

function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 shrink-0 w-14">
        <span className="text-[11px] text-[var(--color-text-3)]">{stars}</span>
        <Star className="h-3 w-3 fill-[#f59e0b] stroke-[#f59e0b]" />
      </div>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-[#f59e0b] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-[var(--color-text-4)] shrink-0 w-6 text-right">{count}</span>
    </div>
  )
}

// ── Review Card ───────────────────────────────────────────────

function ReviewCard({ review }: { review: ReviewItem }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = review.text.length > 160

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)]">
            <Globe className="h-4 w-4 text-[var(--color-text-4)]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--color-text)]">{review.source}</p>
            <p className="text-[10px] text-[var(--color-text-4)]">{review.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StarRating rating={review.rating} size="sm" />
          <SentimentBadge sentiment={review.sentiment} />
        </div>
      </div>

      <p className={cn('text-sm text-[var(--color-text-2)]', !expanded && isLong && 'line-clamp-3')}>
        &ldquo;{review.text}&rdquo;
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-[var(--color-accent)] hover:underline"
        >
          {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
        </button>
      )}
    </div>
  )
}

// ── Sentiment Donut ───────────────────────────────────────────

function SentimentDonut({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const total = positive + neutral + negative || 1
  const posPct = (positive / total) * 100
  const neuPct = (neutral / total) * 100
  const negPct = (negative / total) * 100

  // Simplified bar-based visualization
  return (
    <div className="space-y-2">
      {[
        { label: 'Positive', value: positive, pct: posPct, color: '#10b981' },
        { label: 'Neutral',  value: neutral,  pct: neuPct, color: '#94a3b8' },
        { label: 'Negative', value: negative, pct: negPct, color: '#ef4444' },
      ].map(({ label, value, pct, color }) => (
        <div key={label} className="flex items-center gap-3">
          <div className="w-16 text-[11px] text-[var(--color-text-3)] shrink-0">{label}</div>
          <div className="flex-1 h-3 rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <div className="w-8 text-right text-[11px] font-medium text-[var(--color-text-2)] shrink-0">{value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function ReputationPage() {
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reputation', orgId],
    queryFn: () => reputationApi.get(),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30,
  })

  const refreshMutation = useMutation({
    mutationFn: () => reputationApi.refresh(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reputation', orgId] })
      toast.success('Reputation report refreshed')
    },
    onError: () => toast.error('Failed to refresh reputation data'),
  })

  const reputation = (data as { reputation: ReputationReport } | undefined)?.reputation

  const dist = reputation?.ratingDistribution ?? {}
  const distTotal = Object.values(dist).reduce((s, v) => s + (v as number), 0)

  return (
    <>
      <PageHeader
        title="Reputation"
        description="Online reviews, sentiment analysis, and brand perception across the web."
        icon={<Shield className="h-5 w-5" />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Refreshing…</>
              : <><RefreshCw className="h-3.5 w-3.5" /> Refresh data</>}
          </Button>
        }
      />

      {isLoading ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 py-16 text-[var(--color-text-4)]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Analysing reputation across the web…</p>
        </div>
      ) : isError && !reputation ? (
        <EmptyState
          icon={<Shield className="h-10 w-10" />}
          heading="Could not load reputation data"
          description="Click refresh to try again."
          action={{ label: 'Refresh', href: '/reputation' }}
          className="mt-12"
        />
      ) : reputation ? (
        <div className="mt-6 space-y-6">

          {/* ── Overview row ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Overall rating */}
            <Card className="flex flex-col items-center justify-center py-6">
              <span className="text-5xl font-black text-[var(--color-text)]">
                {reputation.overallRating.toFixed(1)}
              </span>
              <div className="mt-2">
                <StarRating rating={reputation.overallRating} size="lg" />
              </div>
              <p className="mt-1.5 text-xs text-[var(--color-text-4)]">
                {reputation.totalReviews.toLocaleString()} total reviews
              </p>
            </Card>

            {/* Sentiment score */}
            <Card className="flex flex-col items-center justify-center py-6">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-border)" strokeWidth="8" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke={reputation.sentimentScore >= 70 ? '#10b981' : reputation.sentimentScore >= 40 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(reputation.sentimentScore / 100) * 213.6} 213.6`}
                  />
                </svg>
                <span className="text-xl font-black text-[var(--color-text)]">{reputation.sentimentScore}</span>
              </div>
              <p className="mt-2 text-xs font-semibold text-[var(--color-text-2)]">Sentiment Score</p>
              <p className="text-[10px] text-[var(--color-text-4)]">out of 100</p>
            </Card>

            {/* Review breakdown */}
            <Card className="py-4 px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-3">
                Sentiment breakdown
              </p>
              <SentimentDonut
                positive={reputation.positiveCount}
                neutral={reputation.neutralCount}
                negative={reputation.negativeCount}
              />
            </Card>

            {/* Rating distribution */}
            <Card className="py-4 px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-3">
                Rating distribution
              </p>
              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((stars) => (
                  <RatingBar
                    key={stars}
                    stars={stars}
                    count={(dist[stars] as number) ?? 0}
                    total={distTotal}
                  />
                ))}
              </div>
            </Card>
          </div>

          {/* ── Summary + Sources row ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" />AI Reputation Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[var(--color-text-2)] leading-relaxed">{reputation.summary}</p>

                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-1">
                    Recommendation
                  </p>
                  <p className="text-sm text-[var(--color-text-2)]">{reputation.responseRecommendation}</p>
                </div>

                {reputation.topThemes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-2">
                      Recurring Themes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {reputation.topThemes.map((theme) => (
                        <Badge key={theme} variant="outline" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4 text-accent" />Data Sources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reputation.sources.map((source) => (
                  <div
                    key={source}
                    className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-[var(--color-text-4)]" />
                      <span className="text-xs text-[var(--color-text-2)]">{source}</span>
                    </div>
                    <a
                      href={`https://${source}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-accent)] hover:opacity-80"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
                <p className="text-[10px] text-[var(--color-text-4)] pt-2">
                  Last updated:{' '}
                  {reputation.fetchedAt
                    ? new Date(reputation.fetchedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Recent Reviews ── */}
          {reputation.recentReviews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[var(--color-text-4)]" />
                  Recent Reviews
                </h2>
                <Badge variant="outline" className="text-xs">
                  {reputation.recentReviews.length} reviews
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {reputation.recentReviews.map((review, i) => (
                  <ReviewCard key={i} review={review} />
                ))}
              </div>
            </div>
          )}

        </div>
      ) : null}
    </>
  )
}
