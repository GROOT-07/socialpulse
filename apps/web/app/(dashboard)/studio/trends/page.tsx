'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, Flame, Sparkles, ArrowUpRight, RefreshCw,
  Loader2, Instagram, Facebook, Youtube, Globe, MessageCircle,
  Star, ChevronRight, Rss, Calendar,
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

interface TrendingTopic {
  id: string
  topic: string
  category: string
  searchVolume: number
  trendScore: number
  trendDelta: number
  competitorsCovering: number
  suggestedPostDraft: string | null
  platform: string | null
  fetchedAt: string
}

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

interface CompetitorPost {
  id: string
  caption: string
  platform: string
  likesCount: number
  commentsCount: number
  engagementRate: number
  postedAt: string
  contentType: string
}

// ── Helpers ───────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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

// ── Trending Topic Card ───────────────────────────────────────

function TrendCard({ topic, onCreatePost }: { topic: TrendingTopic; onCreatePost: () => void }) {
  const Icon = topic.platform ? (PLATFORM_ICONS[topic.platform] ?? Globe) : TrendingUp
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 hover:border-[var(--color-border-2)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-light)]">
            <Icon className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">{topic.topic}</p>
            <p className="text-[10px] text-[var(--color-text-4)] mt-0.5 capitalize">{topic.category.toLowerCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-success-light)] text-[var(--color-success-text)]">
          <ArrowUpRight className="h-2.5 w-2.5" />
          {topic.trendDelta > 0 ? `+${topic.trendDelta}%` : `${topic.trendDelta}%`}
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-4)]">
        {topic.searchVolume > 0 && (
          <span>{(topic.searchVolume / 1000).toFixed(0)}K searches</span>
        )}
        <span>Score: <strong className="text-[var(--color-text-3)]">{topic.trendScore}</strong></span>
        {topic.competitorsCovering > 0 && (
          <span>{topic.competitorsCovering} competitors on this</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-7 text-xs gap-1"
          onClick={onCreatePost}
        >
          <Sparkles className="h-3 w-3" /> Create post
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
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
  const [copied, setCopied] = useState(false)

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: `var(--platform-${idea.platform.toLowerCase()})` }} />
          <span className="text-xs font-semibold text-[var(--color-text-2)]">{idea.platform}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${urgencyColor(idea.urgency)}1A`, color: urgencyColor(idea.urgency) }}
          >
            {idea.urgency}
          </div>
          <div
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${viralColor(idea.estimatedViralScore)}1A`, color: viralColor(idea.estimatedViralScore) }}
          >
            🔥 {idea.estimatedViralScore}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-[var(--color-text-4)] uppercase tracking-wide mb-1">Trend</p>
        <p className="text-sm font-medium text-[var(--color-text)]">{idea.trend}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-[var(--color-text-4)] uppercase tracking-wide mb-1">Your angle</p>
        <p className="text-sm text-[var(--color-text-2)]">{idea.contentAngle}</p>
      </div>

      <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
        <p className="text-[10px] font-semibold text-[var(--color-text-4)] uppercase tracking-wide mb-0.5">Caption hook</p>
        <p className="text-sm text-[var(--color-text-2)] italic">"{idea.captionHook}"</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {idea.hashtags.slice(0, 5).map((tag) => (
          <span key={tag} className="rounded-full text-[10px] px-2 py-0.5" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent-text)' }}>
            {tag}
          </span>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs gap-1"
        asChild
      >
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
  const urgency = daysLeft <= 3 ? 'var(--color-danger)' : daysLeft <= 7 ? 'var(--color-warning)' : 'var(--color-text-3)'

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--color-accent-light)]">
          <span className="text-[10px] font-bold text-[var(--color-accent-text)]">
            {new Date(day.date).toLocaleString('en', { month: 'short' }).toUpperCase()}
          </span>
          <span className="text-sm font-bold text-[var(--color-accent)]">{new Date(day.date).getDate()}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{day.name}</p>
          <p className="text-[10px] text-[var(--color-text-4)] capitalize">{day.category.toLowerCase().replace(/_/g, ' ')}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold" style={{ color: urgency }}>
          {daysLeft === 0 ? 'Today!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d away`}
        </span>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
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

  const [platform, setPlatform] = useState<string | undefined>(undefined)

  const { data: topics = [], isLoading: topicsLoading, refetch: refetchTopics } = useQuery({
    queryKey: ['trending-topics', orgId],
    queryFn: () => apiClient.get<TrendingTopic[]>(`/api/orgs/${orgId}/trending`),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30, // 30 min
  })

  const { data: specialDays = [] } = useQuery({
    queryKey: ['special-days-upcoming'],
    queryFn: () => apiClient.get<SpecialDay[]>('/api/special-days/upcoming?days=30'),
    staleTime: 1000 * 60 * 60,
  })

  const ideasMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ ideas: TrendingIdea[] }>('/api/ai/trending-ideas', { platform, count: 6 }),
    onError: () => toast.error('Failed to generate ideas. Check your API configuration.'),
  })

  const ideas = ideasMutation.data?.ideas ?? []

  const PLATFORMS = [
    { id: undefined, label: 'All' },
    { id: 'INSTAGRAM', label: 'Instagram' },
    { id: 'FACEBOOK', label: 'Facebook' },
    { id: 'YOUTUBE', label: 'YouTube' },
  ]

  return (
    <div className="px-7 py-7 max-w-[1280px] mx-auto">
      <PageHeader
        title="Trending Now"
        description="Real-time intelligence feed — what's hot in your industry right now"
        icon={<TrendingUp className="h-5 w-5" />}
      />

      <div className="mt-6 space-y-8">
        {/* ── AI Ideas section ─────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text)]">AI Content Ideas from Trends</h2>
              <p className="text-xs text-[var(--color-text-4)]">Tailored specifically for {activeOrg?.name ?? 'your org'}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Platform filter */}
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
                className="gap-2"
                disabled={ideasMutation.isPending}
                onClick={() => ideasMutation.mutate()}
              >
                {ideasMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate ideas</>
                )}
              </Button>
            </div>
          </div>

          {ideasMutation.isPending && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 animate-pulse">
                  {[60, 100, 80, 40].map((w, j) => (
                    <div key={j} className="h-3 rounded bg-[var(--color-surface-2)]" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {!ideasMutation.isPending && ideas.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ideas.map((idea, i) => <IdeaCard key={i} idea={idea} />)}
            </div>
          )}

          {!ideasMutation.isPending && ideas.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
              <Flame className="h-8 w-8 text-[var(--color-text-4)] mx-auto mb-2" />
              <p className="text-sm text-[var(--color-text-3)]">Click "Generate ideas" to get AI-powered content ideas based on what's trending in your industry right now.</p>
            </div>
          )}
        </div>

        {/* ── Trending topics from DB ───────────── */}
        {topics.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[var(--color-text)]">Trending Topics This Week</h2>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => refetchTopics()}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.slice(0, 9).map((topic) => (
                <TrendCard
                  key={topic.id}
                  topic={topic}
                  onCreatePost={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Upcoming special days ─────────────── */}
        {specialDays.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[var(--color-text)]">Upcoming Content Opportunities</h2>
              <Link href="/studio/calendar" className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">
                View full calendar <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {specialDays.slice(0, 10).map((day) => (
                <SpecialDayCard key={day.id} day={day} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state when nothing loaded */}
        {!topicsLoading && topics.length === 0 && ideas.length === 0 && (
          <EmptyState
            icon={<TrendingUp className="h-10 w-10" />}
            title="Trends feed is empty"
            description="Generate AI ideas above, or wait for the weekly trending topics sync to populate your feed."
            action={
              <Button className="gap-2" onClick={() => ideasMutation.mutate()}>
                <Sparkles className="h-4 w-4" /> Generate ideas now
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}
