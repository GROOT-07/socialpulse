'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Trash2, Users, TrendingUp, Eye, BarChart2, Instagram, Facebook, Youtube, Search } from 'lucide-react'
import Link from 'next/link'
import { competitorApi, type Competitor } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatNumber } from '@/lib/utils'
import { toast } from 'sonner'

const PLATFORM_ICONS = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  YOUTUBE: Youtube,
} as const

const PLATFORM_COLORS = {
  INSTAGRAM: 'var(--platform-instagram)',
  FACEBOOK: 'var(--platform-facebook)',
  YOUTUBE: 'var(--platform-youtube)',
} as const

function CompetitorCard({ competitor, onRemove, onSync }: {
  competitor: Competitor
  onRemove: (id: string) => void
  onSync: (id: string) => void
}) {
  const Icon = PLATFORM_ICONS[competitor.platform] ?? BarChart2
  const color = PLATFORM_COLORS[competitor.platform] ?? 'var(--color-text-4)'
  const m = competitor.latestMetrics

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: `${color}20`, color }}>
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-[var(--color-text)] text-sm">{competitor.name}</p>
              <p className="text-xs text-[var(--color-text-4)] font-mono">@{competitor.handle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onSync(competitor.id)} aria-label="Sync">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger hover:text-danger" onClick={() => onRemove(competitor.id)} aria-label="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
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
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-[var(--color-text-4)]">No data — sync pending</p>
        )}
        <div className="mt-3 flex gap-2">
          <Link href={`/competitors/content?id=${competitor.id}`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full text-xs h-7">View Posts</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function AddCompetitorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', platform: 'INSTAGRAM', handle: '' })
  const mutation = useMutation({
    mutationFn: () => competitorApi.add({ name: form.name, platform: form.platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE', handle: form.handle }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitors'] })
      toast.success('Competitor added')
      onClose()
      setForm({ name: '', platform: 'INSTAGRAM', handle: '' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Competitor</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Brand Name</Label>
            <Input placeholder="Nike" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="FACEBOOK">Facebook</SelectItem>
                <SelectItem value="YOUTUBE">YouTube</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Handle / Username</Label>
            <Input placeholder="nike" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || !form.handle || mutation.isPending}>
            {mutation.isPending ? 'Adding…' : 'Add Competitor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function CompetitorsPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['competitors'],
    queryFn: () => competitorApi.list(),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => competitorApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competitors'] }); toast.success('Removed') },
  })

  const syncMutation = useMutation({
    mutationFn: (id: string) => competitorApi.sync(id),
    onSuccess: () => toast.success('Sync queued'),
  })

  const competitors = data?.competitors ?? []

  return (
    <>
      <PageHeader
        title="Competitors"
        description="Track competitor profiles and benchmark your performance."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/competitors/gap-analysis">
              <Button variant="secondary" size="sm">Gap Analysis</Button>
            </Link>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Competitor
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6 space-y-3">
              <div className="skeleton h-9 w-full rounded" />
              <div className="skeleton h-24 w-full rounded" />
            </CardContent></Card>
          ))}
        </div>
      ) : competitors.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState
            icon={<Search className="h-12 w-12" />}
            heading="No competitors tracked"
            description="Add competitors to compare follower growth, engagement, and content strategy."
            action={{ label: 'Add Competitor', onClick: () => setAddOpen(true) }}
          />
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {competitors.map(c => (
            <CompetitorCard key={c.id} competitor={c}
              onRemove={id => removeMutation.mutate(id)}
              onSync={id => syncMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      <AddCompetitorDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
