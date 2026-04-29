'use client'

import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  FileText, Loader2, Copy, CheckCircle2, ChevronRight,
  Search, ArrowRight, BookOpen, Target, BarChart2, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────

interface BlogOutline {
  title: string
  metaDescription: string
  slug: string
  sections: Array<{ heading: string; subpoints: string[]; estimatedWords: number }>
  targetKeywords: string[]
  estimatedReadTime: string
}

interface BlogDraft {
  title: string
  metaDescription: string
  slug: string
  content: string
  wordCount: number
  targetKeywords: string[]
  readingTime: string
}

interface KeywordOpportunity {
  keyword: string
  searchVolume: number
  difficulty: number
  category: string
}

// ── Content types ─────────────────────────────────────────────

const CONTENT_TYPES = [
  { id: 'blog', label: 'Blog Post', desc: '800–2000 words' },
  { id: 'article', label: 'Long-form Article', desc: '2000–5000 words' },
  { id: 'faq', label: 'FAQ Page', desc: '20+ questions' },
  { id: 'landing', label: 'Landing Page', desc: 'Service-specific' },
]

// ── Steps ─────────────────────────────────────────────────────

type Step = 'input' | 'outline' | 'draft'

// ── SEO Score Panel ───────────────────────────────────────────

function SEOScorePanel({ draft }: { draft: BlogDraft }) {
  const score = Math.min(100, 40 + (draft.wordCount > 800 ? 20 : 0) + (draft.targetKeywords.length > 0 ? 20 : 0) + (draft.metaDescription.length > 100 ? 20 : 0))
  const color = score >= 75 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-4)]">SEO Analysis</h3>

      {/* Score ring */}
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="rotate-[-90deg]">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-surface-2)" strokeWidth="8" />
            <circle
              cx="32" cy="32" r="26" fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={`${(score / 100) * 163} 163`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold font-mono" style={{ color }}>
            {score}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {score >= 75 ? 'Strong' : score >= 50 ? 'Needs improvement' : 'Weak'}
          </p>
          <p className="text-xs text-[var(--color-text-4)]">Overall SEO score</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {[
          { label: 'Word count', value: `${draft.wordCount.toLocaleString()} words`, ok: draft.wordCount >= 800 },
          { label: 'Reading time', value: draft.readingTime, ok: true },
          { label: 'Target keywords', value: draft.targetKeywords.slice(0, 2).join(', '), ok: draft.targetKeywords.length > 0 },
          { label: 'Meta description', value: `${draft.metaDescription.length} chars`, ok: draft.metaDescription.length >= 120 },
          { label: 'Slug', value: `/${draft.slug}`, ok: true },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: item.ok ? 'var(--color-success)' : 'var(--color-warning)' }}
              />
              <span className="text-xs text-[var(--color-text-3)]">{item.label}</span>
            </div>
            <span className="text-xs font-medium text-[var(--color-text-2)] truncate max-w-[120px]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function BlogWriterPage() {
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''

  const [step, setStep] = useState<Step>('input')
  const [topic, setTopic] = useState('')
  const [contentType, setContentType] = useState('blog')
  const [outline, setOutline] = useState<BlogOutline | null>(null)
  const [draft, setDraft] = useState<BlogDraft | null>(null)
  const [copiedDraft, setCopiedDraft] = useState(false)

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords', orgId],
    queryFn: () => apiClient.get<KeywordOpportunity[]>(`/api/orgs/${orgId}/keywords?limit=10`),
    enabled: !!orgId,
  })

  const outlineMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ outline: BlogOutline }>('/api/ai/generate-blog/outline', {
        topic,
        keywords: keywords.slice(0, 3).map((k) => k.keyword),
      }),
    onSuccess: (data) => {
      setOutline(data.outline)
      setStep('outline')
    },
    onError: () => toast.error('Failed to generate outline. Check your API configuration.'),
  })

  const draftMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ draft: BlogDraft }>('/api/ai/generate-blog/draft', { outline }),
    onSuccess: (data) => {
      setDraft(data.draft)
      setStep('draft')
    },
    onError: () => toast.error('Failed to generate draft. This may take a moment — try again.'),
  })

  function copyDraft() {
    if (!draft) return
    navigator.clipboard.writeText(`# ${draft.title}\n\n${draft.content}`)
    setCopiedDraft(true)
    setTimeout(() => setCopiedDraft(false), 2000)
    toast.success('Article copied to clipboard')
  }

  return (
    <div className="px-7 py-7 max-w-[1280px] mx-auto">
      <PageHeader
        title="Blog & Article Writer"
        description="Generate SEO-optimized long-form content that ranks on Google"
        icon={<FileText className="h-5 w-5" />}
      />

      {/* Step indicator */}
      <div className="mt-6 flex items-center gap-3 mb-6">
        {(['input', 'outline', 'draft'] as Step[]).map((s, i) => {
          const labels = ['1. Topic', '2. Outline', '3. Full Draft']
          const done = step === 'outline' && i === 0 || step === 'draft' && i <= 1
          const active = step === s
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    done ? 'bg-[var(--color-success)] text-white' :
                    active ? 'bg-[var(--color-accent)] text-white' :
                    'bg-[var(--color-surface-2)] text-[var(--color-text-4)]',
                  )}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn('text-sm', active ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text-4)]')}>
                  {labels[i]}
                </span>
              </div>
              {i < 2 && <ChevronRight className="h-4 w-4 text-[var(--color-text-4)]" />}
            </React.Fragment>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Main content area */}
        <div className="space-y-4">
          {/* STEP 1: Input */}
          {step === 'input' && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
              <h2 className="text-base font-semibold text-[var(--color-text)]">What do you want to write about?</h2>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
                  Content type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CONTENT_TYPES.map((ct) => (
                    <button
                      key={ct.id}
                      onClick={() => setContentType(ct.id)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        contentType === ct.id
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]'
                          : 'border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
                      )}
                    >
                      <p className={cn('text-sm font-medium', contentType === ct.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]')}>
                        {ct.label}
                      </p>
                      <p className="text-xs text-[var(--color-text-4)] mt-0.5">{ct.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
                  Topic
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. 'How to choose the right physiotherapist in Hyderabad'"
                  className="w-full rounded-lg border border-[var(--color-border-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-4)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>

              {keywords.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--color-text-4)] mb-2">Suggest from SEO gaps:</p>
                  <div className="flex flex-wrap gap-2">
                    {keywords.slice(0, 6).map((kw) => (
                      <button
                        key={kw.keyword}
                        onClick={() => setTopic(kw.keyword)}
                        className="group flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-3)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        <Search className="h-2.5 w-2.5" />
                        {kw.keyword}
                        {kw.searchVolume > 0 && (
                          <span className="text-[10px] text-[var(--color-text-4)]">{(kw.searchVolume / 1000).toFixed(0)}K/mo</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="gap-2"
                disabled={!topic.trim() || outlineMutation.isPending}
                onClick={() => outlineMutation.mutate()}
              >
                {outlineMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating outline...</>
                ) : (
                  <><BookOpen className="h-4 w-4" /> Generate outline</>
                )}
              </Button>
            </div>
          )}

          {/* STEP 2: Outline */}
          {step === 'outline' && outline && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">{outline.title}</h2>
                <p className="text-xs text-[var(--color-text-4)] mt-1">{outline.metaDescription}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="secondary">{outline.estimatedReadTime}</Badge>
                  <Badge variant="secondary">/{outline.slug}</Badge>
                </div>
              </div>

              <div className="space-y-3">
                {outline.sections.map((section, i) => (
                  <div key={i} className="rounded-lg bg-[var(--color-surface-2)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-[var(--color-text)]">{section.heading}</h3>
                      <span className="text-[10px] text-[var(--color-text-4)]">~{section.estimatedWords}w</span>
                    </div>
                    <ul className="space-y-1">
                      {section.subpoints.map((point, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-[var(--color-text-3)]">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep('input')}>← Back</Button>
                <Button
                  className="gap-2 flex-1"
                  disabled={draftMutation.isPending}
                  onClick={() => draftMutation.mutate()}
                >
                  {draftMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Writing full article...</>
                  ) : (
                    <><FileText className="h-4 w-4" /> Write full article</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Draft */}
          {step === 'draft' && draft && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">{draft.title}</h2>
                  <p className="text-xs text-[var(--color-text-4)] mt-0.5">{draft.wordCount.toLocaleString()} words · {draft.readingTime}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="gap-1.5 h-8 text-xs" onClick={copyDraft}>
                    {copiedDraft ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy article
                  </Button>
                  <Button variant="secondary" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setStep('outline')}>
                    ← Outline
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--color-text-2)] leading-relaxed">
                    {draft.content}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: SEO Panel */}
        <div className="space-y-4">
          {draft && step === 'draft' && <SEOScorePanel draft={draft} />}

          {/* Keyword list */}
          {keywords.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-4)] mb-3">
                SEO Opportunities
              </h3>
              <div className="space-y-2">
                {keywords.slice(0, 5).map((kw) => (
                  <div key={kw.keyword} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text-2)] truncate">{kw.keyword}</p>
                      <p className="text-[10px] text-[var(--color-text-4)]">
                        {kw.searchVolume > 0 ? `${(kw.searchVolume / 1000).toFixed(1)}K/mo` : 'Local'} · D: {kw.difficulty}
                      </p>
                    </div>
                    <button
                      onClick={() => { setTopic(kw.keyword); setStep('input') }}
                      className="ml-2 shrink-0 text-[10px] text-[var(--color-accent)] hover:underline"
                    >
                      Write
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
