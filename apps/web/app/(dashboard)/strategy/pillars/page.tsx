'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Layers } from 'lucide-react'
import { strategyApi, type ContentPillar } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

const PILLAR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

type PillarFormData = { title: string; description: string; percentage: string; color: string; examples: string }
const EMPTY: PillarFormData = { title: '', description: '', percentage: '', color: PILLAR_COLORS[0], examples: '' }

function PillarDialog({ open, onClose, initial, existingColors }: {
  open: boolean; onClose: () => void; initial?: ContentPillar; existingColors: string[]
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<PillarFormData>(
    initial ? { title: initial.title, description: initial.description ?? '', percentage: String(initial.percentage ?? ''), color: initial.color ?? PILLAR_COLORS[0], examples: initial.examples ?? '' } : EMPTY,
  )
  const mutation = useMutation({
    mutationFn: () => {
      const payload = { title: form.title, description: form.description || null, percentage: form.percentage ? Number(form.percentage) : null, color: form.color, examples: form.examples || null }
      return initial ? strategyApi.updatePillar(initial.id, payload) : strategyApi.createPillar(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pillars'] }); toast.success(initial ? 'Updated' : 'Created'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  const f = (k: keyof PillarFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? 'Edit Pillar' : 'New Content Pillar'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={f('title')} placeholder="Educational Content" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={f('description')} className="resize-none h-16 text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>% of Content</Label><Input type="number" min="0" max="100" value={form.percentage} onChange={f('percentage')} placeholder="30" /></div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-1.5 flex-wrap">
                {PILLAR_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${form.color === c ? 'border-[var(--color-text)] scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Examples</Label><Textarea value={form.examples} onChange={f('examples')} className="resize-none h-16 text-sm" placeholder="How-to guides, industry stats, tips…" /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.title || mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PillarsPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['pillars'], queryFn: () => strategyApi.listPillars() })
  const [editTarget, setEditTarget] = useState<ContentPillar | undefined>()
  const deleteMutation = useMutation({
    mutationFn: (id: string) => strategyApi.deletePillar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pillars'] }); toast.success('Deleted') },
  })
  const pillars = data?.pillars ?? []
  const totalPct = pillars.reduce((s, p) => s + (p.percentage ?? 0), 0)

  return (
    <>
      <PageHeader title="Content Pillars" description="Define the content themes that make up your strategy."
        actions={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Pillar</Button>}
      />

      {!isLoading && pillars.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-[var(--color-text-4)]">Content Mix</span>
            <span className={`text-xs font-mono font-bold ${totalPct === 100 ? 'text-success' : 'text-warning'}`}>{totalPct}% allocated</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {pillars.filter(p => p.percentage).map(p => (
              <div key={p.id} className="h-full rounded-sm transition-all" style={{ width: `${p.percentage}%`, background: p.color ?? '#6366f1' }} title={`${p.title} ${p.percentage}%`} />
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><div className="skeleton h-24 w-full rounded" /></CardContent></Card>)}
        </div>
      ) : pillars.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={<Layers className="h-12 w-12" />} heading="No content pillars" description="Define 3–5 content pillars to guide your content strategy." action={{ label: 'New Pillar', onClick: () => setAddOpen(true) }} /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pillars.map(p => (
            <Card key={p.id} className="overflow-hidden">
              <div className="h-1.5" style={{ background: p.color ?? '#6366f1' }} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-[var(--color-text)]">{p.title}</p>
                    {p.percentage && <p className="text-xs font-mono text-[var(--color-text-4)]">{p.percentage}% of content</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditTarget(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger hover:text-danger" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {p.description && <p className="text-xs text-[var(--color-text-3)] mb-1">{p.description}</p>}
                {p.examples && <p className="text-[10px] text-[var(--color-text-4)] italic">{p.examples}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <PillarDialog open={addOpen} onClose={() => setAddOpen(false)} existingColors={pillars.map(p => p.color ?? '')} />
      {editTarget && <PillarDialog open={!!editTarget} onClose={() => setEditTarget(undefined)} initial={editTarget} existingColors={pillars.map(p => p.color ?? '')} />}
    </>
  )
}
