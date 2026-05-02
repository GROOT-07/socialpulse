'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookmarkCheck, Instagram, Facebook, Youtube, FileText,
  Sparkles, Mic, MessageCircle, Search, Rss, Copy, Trash2,
  ChevronDown, ChevronUp, RefreshCw, Loader2, AlertTriangle
} from 'lucide-react'
import { useCopy } from '@/hooks/useCopy'
import { savedApi, type ContentPieceItem } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type ContentType = 'All' | 'POST' | 'REEL_SCRIPT' | 'BLOG' | 'VIDEO_SCRIPT' | 'WHATSAPP_MESSAGE' | 'OUTREACH_MESSAGE' | 'DAILY_BRIEF'

const TYPE_FILTERS: ContentType[] = ['All', 'POST', 'REEL_SCRIPT', 'BLOG', 'VIDEO_SCRIPT', 'WHATSAPP_MESSAGE', 'OUTREACH_MESSAGE', 'DAILY_BRIEF']

const getTypeBadgeColor = (type: string): { bg: string; text: string } => {
  switch (type.toUpperCase()) {
    case 'POST':
      return { bg: 'bg-blue-500/10', text: 'text-blue-400' }
    case 'REEL_SCRIPT':
      return { bg: 'bg-purple-500/10', text: 'text-purple-400' }
    case 'BLOG':
    case 'ARTICLE':
      return { bg: 'bg-indigo-500/10', text: 'text-indigo-400' }
    case 'VIDEO_SCRIPT':
      return { bg: 'bg-red-500/10', text: 'text-red-400' }
    case 'WHATSAPP_MESSAGE':
      return { bg: 'bg-teal-500/10', text: 'text-teal-400' }
    case 'OUTREACH_MESSAGE':
      return { bg: 'bg-amber-500/10', text: 'text-amber-400' }
    case 'DAILY_BRIEF':
      return { bg: 'bg-cyan-500/10', text: 'text-cyan-400' }
    default:
      return { bg: 'bg-gray-500/10', text: 'text-gray-400' }
  }
}

const getPlatformIcon = (platform: string | null) => {
  if (!platform) return null
  switch (platform.toUpperCase()) {
    case 'INSTAGRAM':
      return <Instagram className="h-4 w-4" />
    case 'FACEBOOK':
      return <Facebook className="h-4 w-4" />
    case 'YOUTUBE':
      return <Youtube className="h-4 w-4" />
    case 'WHATSAPP':
      return <MessageCircle className="h-4 w-4" />
    default:
      return null
  }
}

function ContentCard({ item }: { item: ContentPieceItem }) {
  const [expanded, setExpanded] = useState(false)
  const { copy, copied } = useCopy()
  const qc = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => savedApi.delete(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-content'] })
      toast.success('Content archived')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleCopy = async () => {
    const success = await copy(item.content)
    if (success) {
      toast.success('Copied to clipboard')
    }
  }

  const { bg, text } = getTypeBadgeColor(item.type)
  const platformIcon = getPlatformIcon(item.platform)

  return (
    <Card className="bg-surface border border-brand-border rounded-xl overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row: type badge + platform icon + timestamp */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${bg} ${text} border-0 text-xs font-medium`}>
              {item.type}
            </Badge>
            {platformIcon && (
              <div className="text-[var(--color-text-3)]">
                {platformIcon}
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-4)]">
            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>

        {/* Title */}
        <div>
          <h3 className="font-semibold text-sm text-[var(--color-text)] truncate">
            {item.title}
          </h3>
        </div>

        {/* Content preview or full content */}
        <div
          className={`relative rounded-lg bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-text-2)] font-mono overflow-hidden transition-all duration-200 ${
            expanded ? 'max-h-none' : 'max-h-[120px]'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{item.content}</p>
          {!expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--color-surface-2)] to-transparent" />
          )}
        </div>

        {/* Expand toggle */}
        {item.content.split('\n').length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show full content
              </>
            )}
          </button>
        )}

        {/* SEO score badge */}
        {item.seoScore > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[var(--color-text-4)]">SEO Score:</span>
            <Badge variant="success" className="border-0">
              {Math.round(item.seoScore)}%
            </Badge>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between pt-2 border-t border-brand-border">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-8 w-8 p-0 text-[var(--color-text-3)] hover:text-[var(--color-accent)]"
              title="Copy content"
            >
              <Copy className={`h-4 w-4 ${copied ? 'text-success' : ''}`} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="h-8 w-8 p-0 text-[var(--color-text-3)] hover:text-danger"
              title="Archive content"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          {item.generatedByAI && (
            <Badge variant="accent" className="border-0 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonCard() {
  return (
    <Card className="bg-surface border border-brand-border rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="h-6 bg-surface-2 rounded w-24" />
        <div className="h-4 bg-surface-2 rounded w-full" />
        <div className="h-20 bg-surface-2 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-surface-2 rounded" />
          <div className="h-8 w-8 bg-surface-2 rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function SavedPostsPage() {
  const [selectedType, setSelectedType] = useState<ContentType>('All')
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['saved-content', selectedType],
    queryFn: () => savedApi.list(selectedType === 'All' ? undefined : selectedType),
  })

  const items = data ?? []
  const isEmpty = !isLoading && items.length === 0

  return (
    <>
      <PageHeader
        title="Saved Posts"
        description="Your collection of saved and drafted content pieces."
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => qc.invalidateQueries({ queryKey: ['saved-content'] })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />

      {/* Type filter tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {TYPE_FILTERS.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedType === type
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface)]'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<AlertTriangle className="h-12 w-12 text-danger" />}
              heading="Error loading content"
              description="There was a problem loading your saved content. Please try again."
              action={{ label: 'Retry', onClick: () => qc.invalidateQueries({ queryKey: ['saved-content'] }) }}
            />
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BookmarkCheck className="h-12 w-12" />}
              heading="No saved content yet"
              description="Generate content in the Content Studio and save it here."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  )
}
                                                         