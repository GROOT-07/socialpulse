'use client'

import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Sparkles, Copy, CalendarPlus, Clock, TrendingUp, Instagram,
  Facebook, Youtube, MessageCircle, Search, Loader2, CheckCircle2,
  RefreshCw, Lightbulb, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────

interface GeneratedPost {
  variation: number
  caption: string
  hashtags: string[]
  callToAction: string
  seoScore: number
  tone: string
  estimatedReach: string
}

interface KeywordOpportunity {
  keyword: string
  searchVolume: number
}

// ── Platform config ───────────────────────────────────────────

const PLATFORMS = [
  { id: 'INSTAGRAM', label: 'Instagram', icon: Instagram, color: 'var(--platform-instagram)' },
  { id: 'FACEBOOK',  label: 'Facebook',  icon: Facebook,  color: 'var(--platform-facebook)' },
  { id: 'YOUTUBE',   label: 'YouTube',   icon: Youtube,   color: 'var(--platform-youtube)' },
  { id: 'WHATSAPP',  label: 'WhatsApp',  icon: MessageCircle, color: 'var(--platform-whatsapp)' },
] as const

const CONTENT_TYPES = ['Post', 'Story', 'Reel Caption', 'Carousel', 'Short Caption']
const TONES = ['Professional', 'Friendly', 'Urgent', 'Educational', 'Celebratory', 'Inspirational']
const LENGTHS = [
  { id: 'short',  label: 'Short (50–80w)' },
  { id: 'medium', label: 'Medium (80–150w)' },
  { id: 'long',   label: 'Long (150–250w)' },
]

// ── Helpers ───────────────────────────────────────────────────

function seoColor(score: number) {
  if (score >= 75) return 'var(--color-success)'
  if (score >= 50) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function engagementLabel(reach: string) {
  if (reach.includes('10K') || reach.includes('20K') || reach.includes('50K')) return { label: 'Viral', color: 'var(--color-success)' }
  if (reach.includes('5K') || reach.includes('4K') || reach.includes('3K')) return { label: 'High', color: 'var(--color-accent)' }
  if (reach.includes('2K') || reach.includes('1K')) return { label: 'Medium', color: 'var(--color-warning)' }
  return { label: 'Low', color: 'var(--color-text-4)' }
}

// ── Post Variation Card ───────────────────────────────────────

function PostCard({ post, platform }: { post: GeneratedPost; platform: string }) {
  const [copied, setCopied] = useState(false)
  const engagement = engagementLabel(post.estimatedReach)

  function copyAll() {
    const text = `${post.caption}\n\n${post.hashtags.join(' ')}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Post copied to clipboard')
  }

  function copyHashtags() {
    navigator.clipboard.writeText(post.hashtags.join(' '))
    toast.success('Hashtags copied')
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-4)]">
          Variation {post.variation}
        </span>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `${engagement.color}1A`, color: engagement.color }}
          >
            <TrendingUp className="h-2.5 w-2.5" />
            {engagement.label}
          </div>
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `${seoColor(post.seoScore)}1A`, color: seoColor(post.seoScore) }}
          >
            SEO {post.seoScore}
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="rounded-lg bg-[var(--color-surface-2)] p-3">
        <p className="text-sm text-[var(--color-text-2)] leading-relaxed whitespace-pre-wrap">
          {post.caption}
        </p>
      </div>

      {/* CTA */}
      {post.callToAction && (
        <p className="text-xs font-medium text-[var(--color-accent)]">💬 CTA: {post.callToAction}</p>
      )}

      {/* Hashtags */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">
            Hashtags ({post.hashtags.length})
          </span>
          <button
            onClick={copyHashtags}
            className="text-[10px] text-[var(--color-accent)] hover:underline"
          >
            Copy all
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {post.hashtags.slice(0, 8).map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent-text)' }}
            >
              {tag}
            </span>
          ))}
          {post.hashtags.length > 8 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] text-[var(--color-text-4)]">
              +{post.hashtags.length - 8} more
            </span>
          )}
        </div>
      </div>

      {/* Estimated reach */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-4)]">
        <Clock className="h-3 w-3" />
        <span>Estimated reach: <strong className="text-[var(--color-text-3)]">{post.estimatedReach}</strong></span>
        <span className="mx-1">·</span>
        <span>Tone: <strong className="text-[var(--color-text-3)] capitalize">{post.tone}</strong></span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-[var(--color-border)]">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={copyAll}>
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied!' : 'Copy post'}
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5">
          <CalendarPlus className="h-3.5 w-3.5" /> Schedule
        </Button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function PostGeneratorPage() {
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''

  const [platform, setPlatform] = useState('INSTAGRAM')
  const [contentType, setContentType] = useState('Post')
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('Professional')
  const [length, setLength] = useState('medium')
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [includeEmojis, setIncludeEmojis] = useState(true)
  const [includeCTA, setIncludeCTA] = useState(true)

  // Fetch keywords for suggestions
  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords', orgId],
    queryFn: () => apiClient.get<KeywordOpportunity[]>(`/api/orgs/${orgId}/keywords?limit=5`),
    enabled: !!orgId,
  })

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ posts: GeneratedPost[] }>('/api/ai/generate-post', {
        platform,
        contentType,
        topic,
        tone,
        keywords: keywords.map((k) => k.keyword).slice(0, 3),
      }),
    onError: () => toast.error('Failed to generate posts. Check your API key configuration.'),
  })

  const posts = generateMutation.data?.posts ?? []

  return (
    <div className="px-7 py-7 max-w-[1280px] mx-auto">
      <PageHeader
        title="Post Generator"
        description="AI-powered posts optimized for engagement, SEO, and platform algorithms"
        icon={<Sparkles className="h-5 w-5" />}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* ── Left: Controls ───────────────────── */}
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-5">
            {/* Platform tabs */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
                Platform
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlatform(p.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                        platform === p.id
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)]',
                      )}
                    >
                      <Icon className="h-4 w-4" style={{ color: platform === p.id ? 'var(--color-accent)' : p.color }} />
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content type */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
                Content type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setContentType(ct)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      contentType === ct
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)]',
                    )}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
                Topic
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. 'New year offer — 30% off all services' or 'Tips to stay healthy this monsoon'"
                rows={3}
                className="w-full rounded-lg border border-[var(--color-border-2)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-4)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-none"
              />
              {keywords.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-[var(--color-text-4)] mb-1.5">Trending keywords for you:</p>
                  <div className="flex flex-wrap gap-1">
                    {keywords.slice(0, 4).map((kw) => (
                      <button
                        key={kw.keyword}
                        onClick={() => setTopic(kw.keyword)}
                        className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-[var(--color-text-3)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        {kw.keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tone */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
                Tone
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      tone === t
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)]',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Length */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
                Length
              </label>
              <div className="flex gap-2">
                {LENGTHS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLength(l.id)}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-xs transition-colors',
                      length === l.id
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)]',
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block">
                Include
              </label>
              {[
                { id: 'hashtags', label: 'Hashtags', value: includeHashtags, set: setIncludeHashtags },
                { id: 'emojis',   label: 'Emojis',   value: includeEmojis,   set: setIncludeEmojis },
                { id: 'cta',      label: 'Call-to-action', value: includeCTA, set: setIncludeCTA },
              ].map((toggle) => (
                <label key={toggle.id} className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => toggle.set(!toggle.value)}
                    className={cn(
                      'h-5 w-9 rounded-full transition-colors relative cursor-pointer',
                      toggle.value ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]',
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                        toggle.value ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </div>
                  <span className="text-sm text-[var(--color-text-2)]">{toggle.label}</span>
                </label>
              ))}
            </div>

            {/* Generate button */}
            <Button
              className="w-full gap-2"
              disabled={!topic.trim() || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate 3 variations</>
              )}
            </Button>
          </div>
        </div>

        {/* ── Right: Generated posts ───────────── */}
        <div className="space-y-4">
          {generateMutation.isPending && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                  {[60, 100, 80, 40].map((w, j) => (
                    <div key={j} className="h-3 rounded animate-pulse bg-[var(--color-surface-2)]" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {!generateMutation.isPending && posts.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--color-text-2)]">
                  3 variations generated for <strong>{platform.charAt(0) + platform.slice(1).toLowerCase()}</strong>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                  onClick={() => generateMutation.mutate()}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {posts.map((post) => (
                  <PostCard key={post.variation} post={post} platform={platform} />
                ))}
              </div>
            </>
          )}

          {!generateMutation.isPending && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-16 text-center">
              <Sparkles className="h-10 w-10 text-[var(--color-text-4)] mb-3" />
              <p className="text-sm font-medium text-[var(--color-text-2)]">Ready to generate</p>
              <p className="text-xs text-[var(--color-text-4)] mt-1 max-w-xs">
                Select a platform, enter your topic, and click Generate — we'll create 3 ready-to-publish variations.
              </p>
            </div>
          )}

          {generateMutation.isError && (
            <div className="rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] p-4">
              <p className="text-sm text-[var(--color-danger-text)]">
                Failed to generate posts. Ensure your ANTHROPIC_API_KEY is configured.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => generateMutation.reset()}
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
