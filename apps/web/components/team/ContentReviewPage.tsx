'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, Instagram, Facebook, Youtube, FileText,
  Sparkles, RefreshCw, Eye, Check, X,
} from 'lucide-react'
import { teamApi, type ContentPieceItem } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ── Helpers ───────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.FC<{ className?: string }>> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  YOUTUBE: Youtube,
}

const TYPE_LABELS: Record<string, string> = {
  POST: 'Post',
  REEL_SCRIPT: 'Reel Script',
  BLOG: 'Blog',
  VIDEO_SCRIPT: 'Video Script',
  FAQ: 'FAQ',
  LANDING_PAGE: 'Landing Page',
  GOOGLE_POST: 'Google Post',
  ARTICLE: 'Article',
}

function PlatformIcon({ platform }: { platform: string | null }) {
  if (!platform) return <FileText className="h-4 w-4" />
  const Icon = PLATFORM_ICONS[platform] ?? FileText
  return <Icon className="h-4 w-4" />
}

// ── Review card ───────────────────────────────────────────────

function ReviewCard({
  item,
  onApprove,
  onReject,
  pending,
}: {
  item: ContentPieceItem
  onApprove: () => void
  onReject: () => void
  pending: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="group hover:border-[var(--color-accent)]/30 transition-colors">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-light)] text-[var(--color-accent)]">
            <PlatformIcon platform={item.platform} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <p className="font-semibold text-sm text-[var(--color-text)] leading-tight flex-1 min-w-0">
                {item.title}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  {TYPE_LABELS[item.type] ?? item.type}
                </Badge>
                {item.platform && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {item.platform}
                  </Badge>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-4)]">
              AI generated · {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {/* Content preview */}
        <div
          className={`rounded-lg border border-brand-border bg-surface-2 p-3 text-sm text-[var(--color-text-2)] leading-relaxed ${
            expanded ? '' : 'line-clamp-3'
          }`}
        >
          {item.content}
        </div>

        {item.content.length > 200 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            <Eye className="h-3 w-3" />
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}

        {/* Hashtags */}
        {item.hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.hashtags.slice(0, 8).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            onClick={onApprove}
            disabled={pending}
            className="h-8 flex-1 gap-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20 border"
            variant="ghost"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            onClick={onReject}
            disabled={pending}
            className="h-8 flex-1 gap-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 border"
            variant="ghost"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function ContentReviewPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<string>('ALL')

  const { data: items = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['team', 'review'],
    queryFn: () => teamApi.listReviewQueue(),
    staleTime: 30_000,
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      teamApi.reviewPiece(id, action),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team', 'review'] })
    },
  })

  const filtered = filter === 'ALL'
    ? items
    : items.filter((i) => i.platform === filter || i.type === filter)

  const platforms = Array.from(new Set(items.map((i) => i.platform ?? 'GENERAL').filter(Boolean)))

  return (
    <>
      <PageHeader
        title="Content Review"
        description="Review and approve AI-generated content before it goes live."
        icon={<CheckCircle2 className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-brand-border bg-surface-2 p-0.5">
              <button
                onClick={() => setFilter('ALL')}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  filter === 'ALL'
                    ? 'bg-surface text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-4)] hover:text-[var(--color-text-2)]'
                }`}
              >
                All ({items.length})
              </button>
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    filter === p
                      ? 'bg-surface text-[var(--color-text)] shadow-sm'
                      : 'text-[var(--color-text-4)] hover:text-[var(--color-text-2)]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* Loading skeleton */}
      {isLoading && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <Card className="mt-4">
          <CardContent className="p-0">
            <EmptyState
              icon={<CheckCircle2 className="h-12 w-12 text-green-400" />}
              heading="Queue is clear!"
              description="No AI-generated content is pending review. Generate new content in the Content Studio to populate this queue."
              action={{ label: 'Go to Post Generator', href: '/studio/posts' }}
            />
          </CardContent>
        </Card>
      )}

      {/* Items */}
      {!isLoading && filtered.length > 0 && (
        <>
          <div className="mt-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            <p className="text-xs text-[var(--color-text-4)]">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''} pending review
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                pending={reviewMutation.isPending}
                onApprove={() => reviewMutation.mutate({ id: item.id, action: 'approve' })}
                onReject={() => reviewMutation.mutate({ id: item.id, action: 'reject' })}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
