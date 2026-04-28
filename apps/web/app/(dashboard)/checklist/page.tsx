'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCcw, CheckSquare, Square, CheckCircle2, Instagram, Facebook, Youtube } from 'lucide-react'
import { checklistApi, type ChecklistItem } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: 'var(--platform-instagram)',
  FACEBOOK: 'var(--platform-facebook)',
  YOUTUBE: 'var(--platform-youtube)',
}
const PLATFORM_ICONS: Record<string, React.ElementType> = { INSTAGRAM: Instagram, FACEBOOK: Facebook, YOUTUBE: Youtube }

function AddItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ title: '', platform: '', category: '', description: '' })
  const mutation = useMutation({
    mutationFn: () => checklistApi.add({ title: form.title, platform: form.platform || undefined, category: form.category || undefined, description: form.description || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checklist'] }); toast.success('Item added'); onClose(); setForm({ title: '', platform: '', category: '', description: '' }) },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Checklist Item</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Update profile bio" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v: string) => setForm((p) => ({ ...p, platform: v }))}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="FACEBOOK">Facebook</SelectItem>
                  <SelectItem value="YOUTUBE">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Profile, Content…" /></div>
          </div>
          <div className="space-y-1.5"><Label>Description (optional)</Label><Input value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.title || mutation.isPending}>{mutation.isPending ? 'Adding…' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChecklistGroup({ platform, items }: { platform: string | null; items: ChecklistItem[] }) {
  const qc = useQueryClient()
  const toggleMutation = useMutation({
    mutationFn: (id: string) => checklistApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
    onError: (e: Error) => toast.error(e.message),
  })
  const PIcon = platform ? PLATFORM_ICONS[platform] : null
  const color = platform ? PLATFORM_COLORS[platform] : 'var(--color-text-3)'
  const done = items.filter(i => i.isDone).length
  const groups = Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[]

  const renderItems = (its: ChecklistItem[]) => its.map(item => (
    <button key={item.id} onClick={() => toggleMutation.mutate(item.id)}
      className={cn('flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-surface-2', item.isDone && 'opacity-60')}
    >
      {item.isDone ? <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Square className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-4)]" />}
      <div>
        <p className={cn('text-sm font-medium text-[var(--color-text)]', item.isDone && 'line-through text-[var(--color-text-4)]')}>{item.title}</p>
        {item.description && <p className="text-xs text-[var(--color-text-4)] mt-0.5">{item.description}</p>}
      </div>
    </button>
  ))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {PIcon && <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${color}20`, color }}><PIcon className="h-3.5 w-3.5" /></span>}
            <CardTitle className="text-sm">{platform ?? 'General'}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-4)]">{done}/{items.length}</span>
            <div className="h-1.5 w-20 rounded-full bg-surface-2">
              <div className="h-1.5 rounded-full bg-success transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {groups.length > 0 ? (
          groups.map(cat => (
            <div key={cat} className="mb-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">{cat}</p>
              {renderItems(items.filter(i => i.category === cat))}
            </div>
          ))
        ) : renderItems(items)}
      </CardContent>
    </Card>
  )
}

export default function ChecklistPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['checklist'], queryFn: () => checklistApi.get() })
  const resetMutation = useMutation({
    mutationFn: () => checklistApi.reset(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checklist'] }); toast.success('Checklist reset') },
  })

  const items = data?.items ?? []
  const done = items.filter(i => i.isDone).length
  const platforms = Array.from(new Set(items.map(i => i.platform)))
  const generalItems = items.filter(i => !i.platform)

  return (
    <>
      <PageHeader title="Outreach Checklist" description="Track your weekly social media tasks by platform."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending} className="text-xs">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add Item</Button>
          </div>
        }
      />

      {!isLoading && items.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <CheckCircle2 className={`h-5 w-5 ${done === items.length ? 'text-success' : 'text-[var(--color-text-4)]'}`} />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--color-text-3)]">{done} of {items.length} completed</span>
              <span className="font-mono font-semibold text-[var(--color-text)]">{Math.round((done / items.length) * 100)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-2">
              <div className="h-2 rounded-full bg-success transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-6"><div className="skeleton h-40 w-full rounded" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {(platforms.filter((p): p is string => p !== null && p !== undefined)).map(p => (
            <ChecklistGroup key={p} platform={p} items={items.filter(i => i.platform === p)} />
          ))}
          {generalItems.length > 0 && <ChecklistGroup platform={null} items={generalItems} />}
        </div>
      )}
      <AddItemDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
