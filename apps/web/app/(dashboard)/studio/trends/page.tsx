'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, Flame, Sparkles, ArrowUpRight, RefreshCw,
  Loader2, Instagram, Facebook, Youtube, Globe, MessageCircle,
  Star, ChevronRight, Calendar, Brain, Zap, BarChart2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { apiClient, trendsAiApi, type AITrendingTopic } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────

interface TrendingIdea {
  trend: string
  platform: string
  contentAngle: string
  captionHook: string
  hashtags: string[]
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
  estimatedViralScore: number
}

interface SpecialDay {
  id: string
  name: string
  date: string
  category: string
  draftPostTemplate: string | null
}

// ── Helpers ───────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  YOUTUBE: Youtube,
  WHATSAPP: MessageCircle,
}

function urgencyColor(urgency: string) {
  if (urgency === 'HIGH') return 'var(--color-danger)'
  if (urgency === 'MEDIUM') return 'var(--color-warning)'
  return 'var(--color-text-4)'
}

function viralColor(score: number) {
  if (score >= 80) return 'var(--color-success)'
  if (score >= 60) return 'var(--color-warning)'
  return 'var(--color-text-4)'
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function trendDeltaBadgeStyle(delta: number) {
  if (delta > 50) return { bg: 'var(--color-danger-light)', text: 'var(--color-danger)' }
  if (delta > 20) return { bg: 'var(--color-warning-light)', text: 'var(--color-warning)' }
  return { bg: 'var(--color-success-light)', text: 'var(--color-success-text)' }
}

// ── AI Topic Card ──────────────────────────────────────────────

function AITopicCard({ topic }: { topic: AITrendingTopic }) {
  const Icon = topic.platform ? (PLATFORM_ICONS[topic.platform] ?? Globe) : TrendingUp
  const delta = trendDeltaBadgeStyle(topic.trendDelta)

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 hover:border-[var(--color-border-2)] transition-colors flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-light)]">
            <Icon className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text)] leading-tight truncate">
              {topic.topic}
            </p>
            <p className="text-[10px] text-[var(--color-text-4)] mt-0.5 capitalize">
              {topic.category.toLowerCase()}
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: delta.bg, color: delta.text }}
        >
          <ArrowUpRight className="h-2.5 w-2.5" />
          +{topic.trendDelta}%
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-4)]">
        {topic.searchVolume > 0 && (
          <span className="flex items-center gap-0.5">
            <BarChart2 className="h-2.5 w-2.5" />
            {topic.searchVolume >= 1000
              ? `${(topic.searchVolume / 1000).toFixed(0)}K`
              : topic.searchVolume}{' '}
            searches/mo
          </span>
        )}
        {topic.competitorsCovering > 0 && (
          <span className="flex items-center gap-0.5">
            <Zap className="h-2.5 w-2.5" />
            {topic.competitorsCovering} competitors
          </span>
        )}
      </div>

      {topic.suggestedPostDraft && (
        <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 flex-1">
          <p className="text-[10px] font-semibold text-[var(--color-text-4)] uppercase tracking-wide mb-1">
            Post draft
          </p>
          <p className="text-xs text-[var(--color-text-2)] line-clamp-3 italic">
            &ldquo;{topic.suggestedPostDraft}&rdquo;
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1 h-7 text-xs gap-1" asChild>
          <Link href={`/studio/posts?topic=${encodeURIComponent(topic.topic)}`}>
            <Sparkles className="h-3 w-3" /> Create post
          </Link>
        </Button>
        <Button variant="secondary" size="sm" className="h-7 text-xs gap-1" asChild>
          <Link href={`/studio/blog?topic=${encodeURIComponent(topic.topic)}`}>
            Write article <ChevronRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ── AI Idea Card ──────────────────────────────────────────────

function IdeaCard({ idea }: { idea: TrendingIdea }) {
  const Icon = PLATFORM_ICONS[idea.platform] ?? Globe

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: `var(--platform-${idea.platform.toLowerCase()})` }} />
          <span className="text-xs font-semibold text-[var(--color-text-2)]">{idea.platform}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: `${urgencyColor(idea.urgency)}1A`,
              color: urgencyColor(idea.urgency),
            }}
          >
            {idea.urgency}
          </div>
          <div
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: `${viralColor(idea.estimatedViralScore)}1A`,
              color: viralColor(idea.estimatedViralScore),
            }}
          >
            🔥 {idea.estimatedViralScore}
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-[var(--color-text-4)] uppercase tracking-wide mb-1">
          Trend
        </p>
        <p className="text-sm font-medium text-[var(--color-text)]">{idea.trend}</p>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-[var(--color-text-4)] uppercase tracking-wide mb-1">
          Your angle
        </p>
        <p className="text-sm text-[var(--color-text-2)]">{idea.contentAngle}</p>
      </div>

      <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 flex-1">
        <p className="text-[10px] font-semibold text-[var(--color-text-4)] uppercase tracking-wide mb-0.5">
          Caption hook
        </p>
        <p className="text-sm text-[var(--color-text-2)] italic">&ldquo;{idea.captionHook}&rdquo;</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {idea.hashtags.slice(0, 5).map((tag) => (
          <span
            key={tag}
            className="rounded-full text-[10px] px-2 py-0.5"
            style={{
              backgroundColor: 'var(--color-accent-light)',
              color: 'var(--color-accent-text)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <Button variant="secondary" size="sm" className="w-full h-7 text-xs gap-1" asChild>
        <Link href={`/studio/posts?topic=${encodeURIComponent(idea.trend)}&platform=${idea.platform}`}>
          <Sparkles className="h-3 w-3" /> Generate full post
        </Link>
      </Button>
    </div>
  )
}

// ── Special Day Card ──────────────────────────────────────────

function SpecialDayCard({ day }: { day: SpecialDay }) {
  const daysLeft = daysUntil(day.date)
  const urgency =
    daysLeft <= 3
      ? 'var(--color-danger)'
      : daysLeft <= 7
        ? 'var(--color-warning)'
        : 'var(--color-text-3)'

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 hover:border-[var(--color-border-2)] transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--color-accent-light)]">
          <span className="text-[10px] font-bold text-[var(--color-accent-text)]">
            {new Date(day.date).toLocaleString('en', { month: 'short' }).toUpperCase()}
          </span>
          <span className="text-sm font-black text-[var(--color-accent)]">
            {new Date(day.date).getDate()}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{day.name}</p>
          <p className="text-[10px] text-[var(--color-text-4)] capitalize">
            {day.category.toLowerCase().replace(/_/g, ' ')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold" style={{ color: urgency }}>
          {daysLeft === 0 ? 'Today!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d away`}
        </span>
        <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" asChild>
          <Link href={`/studio/posts?topic=${encodeURIComponent(day.name)}`}>
            <Sparkles className="h-3 w-3" /> Prepare
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function TrendingNowPage() {
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''
  const qc = useQueryClient()

  const [platform, setPlatform] = useState<string | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<'ai' | 'ideas' | 'calendar'>('ai')

  // AI-generated trending topics from our discovery service
  const {
    data: aiTopicsData,
    isLoading: aiTopicsLoading,
  } = useQuery({
    queryKey: ['trends-ai', orgId],
    queryFn: () => trendsAiApi.get(),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30,
  })

  const discoverMutation = useMutation({
    mutationFn: () => trendsAiApi.discover(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['trends-ai', orgId] })
      toast.success(`Discovered ${data.topics.length} trending topics`)
    },
    onError: () => toast.error('Failed to discover trends'),
  })

  const { data: specialDays = [] } = useQuery({
    queryKey: ['special-days-upcoming'],
    queryFn: () => apiClient.get<SpecialDay[]>('/api/special-days/upcoming?days=30'),
    staleTime: 1000 * 60 * 60,
  })

  const ideasMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ ideas: TrendingIdea[] }>('/api/ai/trending-ideas', {
        platform,
        count: 6,
      }),
    onError: () => toast.error('Failed to generate ideas'),
  })

  const aiTopics = aiTopicsData?.topics ?? []
  const ideas = ideasMutation.data?.ideas ?? []

  const PLATFORMS = [
    { id: undefined, label: 'All' },
    { id: 'INSTAGRAM', label: 'Instagram' },
    { id: 'FACEBOOK', label: 'Facebook' },
    { id: 'YOUTUBE', label: 'YouTube' },
  ]

  const TABS = [
    { id: 'ai' as const, label: 'AI Trends', icon: Brain },
    { id: 'ideas' as const, label: 'Content Ideas', icon: Sparkles },
    { id: 'calendar' as const, label: 'Upcoming Days', icon: Calendar },
  ]

  return (
    <div className="px-7 py-7 max-w-[1280px] mx-auto">
      <PageHeader
        title="Trending Now"
        description={`Real-time intelligence feed — what's hot in ${activeOrg?.name ? `${activeOrg.name}'s industry` : 'your industry'} right now`}
        icon={<TrendingUp className="h-5 w-5" />}
      />

      {/* ── Tabs ── */}
      <div className="mt-6 flex items-center justify-between mb-6">
        <div className="flex gap-1 rounded-xl bg-[var(--color-surface-2)] p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all',
                activeTab === id
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-3)] hover:text-[var(--color-text-2)]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'ai' && (
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 h-8 text-xs"
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
          >
            {discoverMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Discovering…</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5" /> Rediscover</>
            )}
          </Button>
        )}

        {activeTab === 'ideas' && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-[var(--color-surface-2)] p-1">
              {PLATFORMS.map((p) => (
                <button
                  key={String(p.id)}
                  onClick={() => setPlatform(p.id)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs transition-colors',
                    platform === p.id
                      ? 'bg-[var(--color-surface)] font-semibold text-[var(--color-text)] shadow-sm'
                      : 'text-[var(--color-text-3)] hover:text-[var(--color-text-2)]',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button
              className="gap-2 h-8 text-xs"
              disabled={ideasMutation.isPending}
              onClick={() => ideasMutation.mutate()}
            >
              {ideasMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Generate</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── AI Trends Tab ── */}
      {activeTab === 'ai' && (
        <div>
          {aiTopicsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 animate-pulse"
                >
                  {[60, 100, 80, 40, 60].map((w, j) => (
                    <div
                      key={j}
                      className="h-3 rounded bg-[var(--color-surface-2)]"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : aiTopics.length > 0 ? (
            <>
              {aiTopicsData?.fromCache && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[va