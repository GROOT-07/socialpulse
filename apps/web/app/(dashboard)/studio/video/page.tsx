'use client'

import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Video, Loader2, Copy, CheckCircle2, ChevronRight,
  Clock, Zap, Youtube, Instagram, Clapperboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────

interface ScriptSection {
  timestamp: string
  voiceover: string
  visualSuggestion: string
}

interface VideoScript {
  hook: string
  sections: ScriptSection[]
  callToAction: string
  duration: string
  contentType: 'REEL' | 'YOUTUBE_SHORT' | 'YOUTUBE_VIDEO'
  hashtags: string[]
}

// ── Config ────────────────────────────────────────────────────

const FORMATS = [
  { id: 'INSTAGRAM_REEL_30', label: 'Reel 30s', platform: 'INSTAGRAM', duration: '30s', icon: Instagram },
  { id: 'INSTAGRAM_REEL_60', label: 'Reel 60s', platform: 'INSTAGRAM', duration: '60s', icon: Instagram },
  { id: 'YOUTUBE_SHORT',     label: 'YT Short',  platform: 'YOUTUBE',   duration: '60s', icon: Youtube },
  { id: 'YOUTUBE_3MIN',      label: 'YT 3-5 min', platform: 'YOUTUBE',  duration: '300s', icon: Youtube },
] as const

const HOOK_STYLES = ['Question', 'Shocking stat', 'Story', 'How-to', 'Before & After', 'Myth bust']

// ── Script Display Component ──────────────────────────────────

function ScriptDisplay({ script }: { script: VideoScript }) {
  const [copiedHook, setCopiedHook] = useState(false)
  const [copiedFull, setCopiedFull] = useState(false)

  function copyFull() {
    const full = [
      `HOOK: ${script.hook}`,
      '',
      ...script.sections.map((s) => `[${s.timestamp}]\nVOICEOVER: ${s.voiceover}\nVISUAL: ${s.visualSuggestion}`),
      '',
      `CTA: ${script.callToAction}`,
    ].join('\n')
    navigator.clipboard.writeText(full)
    setCopiedFull(true)
    setTimeout(() => setCopiedFull(false), 2000)
    toast.success('Full script copied')
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-text)]">Generated Script</span>
          <Badge variant="secondary" className="text-[10px]">{script.duration}</Badge>
          <Badge variant="secondary" className="text-[10px]">{script.contentType.replace(/_/g, ' ')}</Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={copyFull}>
          {copiedFull ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" /> : <Copy className="h-3.5 w-3.5" />}
          Copy script
        </Button>
      </div>

      <div className="p-5 space-y-5">
        {/* Hook */}
        <div className="rounded-lg border-l-4 border-[var(--color-accent)] bg-[var(--color-accent-light)] pl-4 pr-3 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent-text)]">
              ⚡ HOOK — First 3 seconds
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(script.hook); setCopiedHook(true); setTimeout(() => setCopiedHook(false), 1500) }}
              className="text-[10px] text-[var(--color-accent)] hover:underline"
            >
              {copiedHook ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text)]">{script.hook}</p>
        </div>

        {/* Script sections */}
        <div className="space-y-3">
          {script.sections.map((section, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[10px] font-bold text-[var(--color-text-3)]">
                  {idx + 1}
                </div>
                {idx < script.sections.length - 1 && (
                  <div className="w-px flex-1 bg-[var(--color-border)] my-1" />
                )}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-semibold text-[var(--color-accent)]">
                    {section.timestamp}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-0.5">Voiceover</p>
                    <p className="text-sm text-[var(--color-text-2)]">{section.voiceover}</p>
                  </div>
                  <div className="rounded-lg border border-dashed border-[var(--color-border-2)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-0.5">📹 Visual</p>
                    <p className="text-xs text-[var(--color-text-3)] italic">{section.visualSuggestion}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-lg border-l-4 border-[var(--color-success)] bg-[var(--color-success-light)] pl-4 pr-3 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-success-text)] block mb-1">
            🎯 CALL TO ACTION
          </span>
          <p className="text-sm font-semibold text-[var(--color-text)]">{script.callToAction}</p>
        </div>

        {/* Hashtags */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-2">
            Hashtags ({script.hashtags.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {script.hashtags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent-text)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function VideoScriptPage() {
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''

  const [formatId, setFormatId] = useState('INSTAGRAM_REEL_60')
  const [topic, setTopic] = useState('')
  const [hookStyle, setHookStyle] = useState('Question')
  const [includeBroll, setIncludeBroll] = useState(true)

  const selectedFormat = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0]

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ script: VideoScript }>('/api/ai/generate-script', {
        topic,
        platform: selectedFormat.platform,
        duration: selectedFormat.duration,
      }),
    onError: () => toast.error('Failed to generate script. Check your API key configuration.'),
  })

  const script = generateMutation.data?.script ?? null

  return (
    <div className="px-7 py-7 max-w-[1280px] mx-auto">
      <PageHeader
        title="Video & Reel Scripts"
        description="Complete scripts for Instagram Reels, YouTube Shorts, and long-form videos"
        icon={<Video className="h-5 w-5" />}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Controls */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-5 h-fit">
          {/* Format */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
              Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => {
                const Icon = f.icon
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormatId(f.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                      formatId === f.id
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)]',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-xs">{f.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
              Video topic
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. '5 reasons to choose us over competitors' or 'How to treat back pain at home'"
              rows={3}
              className="w-full rounded-lg border border-[var(--color-border-2)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-4)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-none"
            />
          </div>

          {/* Hook style */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)] block mb-2">
              Hook style
            </label>
            <div className="flex flex-wrap gap-1.5">
              {HOOK_STYLES.map((h) => (
                <button
                  key={h}
                  onClick={() => setHookStyle(h)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    hookStyle === h
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)]',
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* B-roll toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setIncludeBroll(!includeBroll)}
              className={cn(
                'h-5 w-9 rounded-full transition-colors relative cursor-pointer',
                includeBroll ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]',
              )}
            >
              <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', includeBroll ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className="text-sm text-[var(--color-text-2)]">Include B-roll suggestions</span>
          </label>

          <Button
            className="w-full gap-2"
            disabled={!topic.trim() || generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Writing script...</>
            ) : (
              <><Clapperboard className="h-4 w-4" /> Generate script</>
            )}
          </Button>
        </div>

        {/* Right: Script */}
        <div>
          {generateMutation.isPending && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 space-y-4 animate-pulse">
              {[80, 100, 60, 90, 70].map((w, i) => (
                <div key={i} className="h-3 rounded bg-[var(--color-surface-2)]" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {!generateMutation.isPending && script && (
            <ScriptDisplay script={script} />
          )}

          {!generateMutation.isPending && !script && !generateMutation.isError && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-16 text-center">
              <Video className="h-10 w-10 text-[var(--color-text-4)] mb-3" />
              <p className="text-sm font-medium text-[var(--color-text-2)]">Your script will appear here</p>
              <p className="text-xs text-[var(--color-text-4)] mt-1 max-w-xs">
                Select a format, enter your topic, and generate a complete timed script ready to film.
              </p>
            </div>
          )}

          {generateMutation.isError && (
            <div className="rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] p-5">
              <p className="text-sm text-[var(--color-danger-text)]">
                Script generation failed. Ensure ANTHROPIC_API_KEY is set in your environment.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => generateMutation.reset()}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
