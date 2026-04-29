'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Users, TrendingUp, Eye, BarChart2,
  Instagram, Facebook, Youtube, MapPin, Check, X,
  Info, Sparkles, Clock, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import { competitorApi, type Competitor, type DiscoveryMeta } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatNumber } from '@/lib/utils'
import { toast } from 'sonner'

/** Simple relative time without date-fns dependency */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ── Platform config ────────────────────────────────────────────

const PLATFORM_ICONS = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  YOUTUBE: Youtube,
} as const

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: 'var(--platform-instagram)',
  FACEBOOK: 'var(--platform-facebook)',
  YOUTUBE: 'var(--platform-youtube)',
}

// ── Status badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'CONFIRMED') {
    return (
      <Badge className="bg-success/10 text-success border-success/20 text-[10px] h-5 px-1.5">
        <Check className="h-2.5 w-2.5 mr-0.5" /> Confirmed
      </Badge>
    )
  }
  if (status === 'DISMISSED') {
    return (
      <Badge variant="outline" className="text-[var(--color-text-4)] text-[10px] h-5 px-1.5">
        Dismissed
      </Badge>
    )
  }
  return (
    <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px] h-5 px-1.5">
      Pending
    </Badge>
  )
}

// ── Competitor card ───────────────────────────────────────────

function CompetitorCard({
  competitor,
  onConfirm,
  onDismiss,
  onSync,
}: {
  competitor: Competitor & {
    status?: string
    discoveryReason?: string
    relevanceScore?: number
    businessName?: string
    address?: string
  }
  onConfirm: (id: string) => void
  onDismiss: (id: string) => void
  onSync: (id: string) => void
}) {
  const Icon = PLATFORM_ICONS[competitor.platform as keyof typeof PLATFORM_ICONS] ?? BarChart2
  const color = PLATFORM_COLORS[competitor.platform] ?? 'var(--color-text-4)'
  const m = competitor.latestMetrics
  const status = competitor.status ?? 'PENDING'
  const isDismissed = status === 'DISMISSED'

  return (
    <Card className={`flex flex-col transition-opacity ${isDismissed ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${color}20`, color }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[var(--color-text)] text-sm truncate">
                {competitor.businessName ?? competitor.name}
              </p>
              <p className="text-xs text-[var(--color-text-4)] font-mono truncate">
                @{competitor.handle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <StatusBadge status={status} />
            {competitor.relevanceScore != null && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
                {competitor.relevanceScore}%
              </Badge>
            )}
          </div>
        </div>

        {/* Discovery badge + reason */}
        <div className="flex items-center gap-1.5 mt-2">
          <Badge variant="outline" className="gap-1 text-[10px] h-5 px-1.5 border-accent/30 text-accent bg-accent-light">
            <Sparkles className="h-2.5 w-2.5" /> Discovered by SocialPulse
          </Badge>
          {competitor.discoveryReason && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--color-text-4)] hover:text-[var(--color-text-2)]"
                    aria-label="Why this competitor?"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <p className="font-semibold mb-1">Why this competitor?</p>
                  <p>{competitor.discoveryReason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Address if available */}
        {competitor.address && (
          <p className="flex items-center gap-1 text-[10px] text-[var(--color-text-4)] mt-1">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{competitor.address}</span>
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex flex-col flex-1">
        {m ? (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Followers', value: m.followers },
              { label: 'Eng. Rate', value: m.engagementRate, pct: true },
              { label: 'Avg Likes', value: m.avgLikes },
              { label: 'Avg Comments', value: m.avgComments },
            ].map(({ label, value, pct }) => (
              <div key={label} className="rounded-lg bg-surface-2 p-2.5">
                <p className="font-mono text-sm font-bold text-[var(--color-text)]">
                  {value == null ? '—' : pct ? `${Number(value).toFixed(1)}%` : formatNumber(value)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mt-0.5">
                  {label}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-[var(--color-text-4)]">
            Sync pending — data will appear after first run
          </p>
        )}

        {/* Actions */}
        <div className="mt-3 flex gap-1.5">
          {status !== 'CONFIRMED' && (
            <Button
              size="sm"
              className="flex-1 text-xs h-7 bg-success/10 text-success hover:bg-success/20 border-0"
              onClick={() => onConfirm(competitor.id)}
            >
              <Check className="h-3 w-3 mr-1" /> Confirm
            </Button>
          )}
          {status !== 'DISMISSED' && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs h-7 text-[var(--color-text-4)] hover:text-danger"
              onClick={() => onDismiss(competitor.id)}
            >
              <X className="h-3 w-3 mr-1" /> Dismiss
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => onSync(competitor.id)}
            aria-label="Sync metrics"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Link href={`/competitors/content?id=${competitor.id}`} className="shrink-0">
            <Button variant="secondary" size="sm" className="text-xs h-7">
              <Eye className="h-3 w-3 mr-1" /> Posts
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Tabs ──────────────────────────────────────────────────────

type FilterTab = 'all' | 'confirmed' | 'pending' | 'dismissed'

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'dismissed', label: 'Dismissed' },
]

// ── Page ──────────────────────────────────────────────────────

export default function CompetitorsPage(): React.JSX.Element {
  const qc = useQueryClient()
  const [tab, setTab] = useState<FilterTab>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['competitors', tab],
    queryFn: () => competitorApi.list(tab === 'all' ? undefined : tab.toUpperCase()),
  })

  const { data: metaData } = useQuery({
    queryKey: ['competitors-meta'],
    queryFn: () => competitorApi.discoveryMeta(),
    staleTime: 30_000,
  })

  const meta = metaData as DiscoveryMeta | undefined

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'CONFIRMED' | 'DISMISSED' }) =>
      competitorApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitors'] })
      qc.invalidateQueries({ queryKey: ['competitors-meta'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const syncMutation = useMutation({
    mutationFn: (id: string) => competitorApi.sync(id),
    onSuccess: () => toast.success('Sync queued'),
  })

  const rediscoverMutation = useMutation({
    mutationFn: () => competitorApi.rediscover(),
    onSuccess: () => {
      toast.success('Competitor discovery started — results will appear in a few minutes')
      qc.invalidateQueries({ queryKey: ['competitors'] })
      qc.invalidateQueries({ queryKey: ['competitors-meta'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const competitors = (data?.competitors ?? []) as Array<
    Competitor & {
      status?: string
      discoveryReason?: string
      relevanceScore?: number
      businessName?: string
      address?: string
    }
  >

  const visibleCompetitors = tab === 'dismissed'
    ? competitors
    : competitors.filter((c) => c.status !== 'DISMISSED')

  const confirmedCount = meta?.counts.confirmed ?? 0
  const pendingCount = meta?.counts.pending ?? 0

  return (
    <>
      <PageHeader
        title="Competitor Intelligence"
        description="Auto-discovered competitors ranked by relevance. Confirm or dismiss each one."
        actions={
          <div className="flex items-center gap-2">
            {/* Last discovery timestamp */}
            {meta?.lastDiscoveryAt && (
              <p className="hidden sm:flex items-center gap-1 text-xs text-[var(--color-text-4)]">
                <Clock className="h-3 w-3" />
                Last run {timeAgo(meta.lastDiscoveryAt)}
              </p>
            )}
            <Link href="/competitors/map">
              <Button variant="secondary" size="sm">
                <MapPin className="mr-1.5 h-3.5 w-3.5" /> Map View
              </Button>
            </Link>
            <Link href="/competitors/gap-analysis">
              <Button variant="secondary" size="sm">
                <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> Gap Analysis
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => rediscoverMutation.mutate()}
              disabled={rediscoverMutation.isPending}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${rediscoverMutation.isPending ? 'animate-spin' : ''}`} />
              Re-discover
            </Button>
          </div>
        }
      />

      {/* Pending confirmation notice */}
      {pendingCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm text-[var(--color-text-2)]">
            <span className="font-semibold">{pendingCount} new competitor{pendingCount !== 1 ? 's' : ''}</span>{' '}
            discovered — confirm or dismiss them below.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-brand-border bg-surface-2 p-0.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-surface text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-4)] hover:text-[var(--color-text-2)]'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <div className="skeleton h-9 w-full rounded" />
                <div className="skeleton h-24 w-full rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleCompetitors.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              heading={
                tab === 'confirmed'
                  ? 'No confirmed competitors yet'
                  : tab === 'dismissed'
                  ? 'No dismissed competitors'
                  : 'Discovering your competitors…'
              }
              description={
                tab === 'all'
                  ? 'SocialPulse automatically discovers competitors based on your industry and location. Click Re-discover to start.'
                  : tab === 'confirmed'
                  ? 'Confirm competitors from the All tab to track them here.'
                  : 'Competitors you dismiss will appear here.'
              }
              action={
                tab === 'all'
                  ? { label: 'Run Discovery', onClick: () => rediscoverMutation.mutate() }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleCompetitors.map((c) => (
            <CompetitorCard
              key={c.id}
              competitor={c}
              onConfirm={(id) => statusMutation.mutate({ id, status: 'CONFIRMED' })}
              onDismiss={(id) => statusMutation.mutate({ id, status: 'DISMISSED' })}
              onSync={(id) => syncMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Confirmed count summary */}
      {confirmedCount > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-4)]">
            {confirmedCount} competitor{confirmedCount !== 1 ? 's' : ''} confirmed · tracking metrics weekly
          </p>
          <Link href="/competitors/content">
            <Button variant="ghost" size="sm" className="text-xs gap-1.5">
              <Eye className="h-3 w-3" /> View Competitor Content
            </Button>
          </Link>
        </div>
      )}
    </>
  )
}
