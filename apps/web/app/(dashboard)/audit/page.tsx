'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, CheckSquare, Square, Instagram, Facebook, Youtube, Trophy } from 'lucide-react'
import { auditApi, type AuditItem } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const PLATFORM_ICONS: Record<string, React.ElementType> = { INSTAGRAM: Instagram, FACEBOOK: Facebook, YOUTUBE: Youtube }
const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: 'var(--platform-instagram)',
  FACEBOOK: 'var(--platform-facebook)',
  YOUTUBE: 'var(--platform-youtube)',
}

function ScoreDial({ score }: { score: number }) {
  const color = score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger'
  return (
    <div className={`flex flex-col items-center justify-center py-4 ${color}`}>
      <p className="font-mono text-5xl font-bold tabular-nums">{score}</p>
      <p className="text-xs font-semibold uppercase tracking-wide mt-1 opacity-70">Profile Score</p>
    </div>
  )
}

function AuditGroup({ platform, items }: { platform: string | null; items: AuditItem[] }) {
  const qc = useQueryClient()
  const toggleMutation = useMutation({
    mutationFn: (id: string) => auditApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit'] }),
    onError: (e: Error) => toast.error(e.message),
  })
  const PIcon = platform ? PLATFORM_ICONS[platform] : null
  const color = platform ? PLATFORM_COLORS[platform] : 'var(--color-text-3)'
  const categories = Array.from(new Set(items.map(i => i.category)))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {PIcon && <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${color}20`, color }}><PIcon className="h-3.5 w-3.5" /></span>}
          <CardTitle className="text-sm">{platform ?? 'General'}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {categories.map(cat => (
          <div key={cat} className="mb-4 last:mb-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">{cat}</p>
            {items.filter(i => i.category === cat).map(item => (
              <button key={item.id} onClick={() => toggleMutation.mutate(item.id)}
                className={cn('flex w-full items-start gap-3 rounded-lg p-2.5 text-left hover:bg-surface-2 transition-colors', item.isDone && 'opacity-60')}
              >
                {item.isDone ? <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Square className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-4)]" />}
                <div>
                  <p className={cn('text-sm font-medium text-[var(--color-text)]', item.isDone && 'line-through text-[var(--color-text-4)]')}>{item.title}</p>
                  {item.description && <p className="text-xs text-[var(--color-text-4)] mt-0.5">{item.description}</p>}
                </div>
              </button>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function AuditPage() {
  const { data, isLoading } = useQuery({ queryKey: ['audit'], queryFn: () => auditApi.get() })
  const items = data?.items ?? []
  const score = data?.score ?? 0
  const platforms = Array.from(new Set(items.map((i: typeof items[0]) => i.platform).filter(Boolean)))
  const generalItems = items.filter((i: typeof items[0]) => !i.platform)

  return (
    <>
      <PageHeader title="Profile Audit" description="Optimize your social media profiles with our recommended checklist." />

      {!isLoading && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <ScoreDial score={score} />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-[var(--color-text-2)]">
                  {score >= 80 ? 'Your profiles are well-optimized.' : score >= 50 ? 'Good start — a few more improvements to go.' : 'Your profiles need some attention.'}
                </p>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-4)]">
                  <Trophy className="h-3.5 w-3.5" />
                  {items.filter((i: typeof items[0]) => i.isDone).length} of {items.length} items complete
                </div>
                <div className="h-2 w-full rounded-full bg-surface-2">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${score}%`, background: score >= 80 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-6"><div className="skeleton h-40 w-full rounded" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {(platforms as string[]).map((p: string) => <AuditGroup key={p} platform={p} items={items.filter((i: typeof items[0]) => i.platform === p)} />)}
          {generalItems.length > 0 && <AuditGroup platform={null} items={generalItems} />}
        </div>
      )}
    </>
  )
}
