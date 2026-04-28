'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Sparkles, Lightbulb, Pencil, Instagram, Facebook, Youtube, Filter } from 'lucide-react'
import { ideasApi, type ContentIdeaItem } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, string> = {
  BACKLOG:   'bg-surface-2 text-[var(--color-text-4)]',
  SCHEDULED: 'bg-accent-light text-accent',
  DONE:      'bg-success/10 text-success',
}
const STATUS_LABELS: Record<string, string> = { BACKLOG: 'Backlog', SCHEDULED: 'Scheduled', DONE: 'Done' }

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Instagram, FACEBOOK: Facebook, YOUTUBE: Youtube,
}

type IdeaFormData = { title: string; description: string; platform: string; captionStarter: string; status: string }
const EMPTY: IdeaFormData = { title: '', description: '', platform: '', captionStarter: '', status: 'BACKLOG' }

function IdeaDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: ContentIdeaItem }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<IdeaFormData>(
    initial ? {
      title: initial.title,
      description: initial.description ?? '',
      platform: initial.platform ?? '',
      captionStarter: initial.captionStarter ?? '',
      status: initial.status,
    } : EMPTY,
  )
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        platform: form.platform || null,
        captionStarter: form.captionStarter || null,
        status: form.status,
      }
      return initial?.id ? ideasApi.update(initial.id, payload) : ideasApi.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ideas'] }); toast.success(initial ? 'Updated' : 'Created'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  const f = (k: keyof IdeaFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? 'Edit Idea' : 'New Content Idea'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={f('title')} placeholder="Behind-the-scenes video tour" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={f('description')} className="resize-none h-16 text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm(p => ({ ...p, platform: v }))}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="FACEBOOK">Facebook</SelectItem>
                  <SelectItem value="YOUTUBE">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BACKLOG">Backlog</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Caption Starter</Label>
            <Input value={form.captionStarter} onChange={f('captionStarter')} placeholder="Did you know…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.title || mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function IdeaCard({ idea, onDelete }: { idea: ContentIdeaItem; onDelete: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const PlatformIcon = idea.platform ? PLATFORM_ICONS[idea.platform] : null
  return (
    <>
      <Card className={`border-l-4 ${idea.aiGenerated ? 'border-l-accent' : 'border-l-brand-border'}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <Badge className={`text-[10px] h-4 px-1.5 rounded-full ${STATUS_COLORS[idea.status] ?? STATUS_COLORS.BACKLOG}`}>
                  {STATUS_LABELS[idea.status] ?? idea.status}
                </Badge>
                {PlatformIcon && <Badge variant="outline" className="text-[10px] h-4 px-1.5 flex items-center gap-1"><PlatformIcon className="h-2.5 w-2.5" />{idea.platform}</Badge>}
                {idea.aiGenerated && <Badge variant="outline" className="text-[10px] h-4 px-1.5 flex items-center gap-1 bg-accent-light text-accent border-accent/20"><Sparkles className="h-2.5 w-2.5" />AI</Badge>}
              </div>
              <p className="font-semibold text-sm text-[var(--color-text)]">{idea.title}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditOpen(true)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger hover:text-danger" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          {idea.description && <p className="text-xs text-[var(--color-text-3)] mb-1.5 line-clamp-2">{idea.description}</p>}
          {idea.captionStarter && <p className="text-xs text-[var(--color-text-4)]"><span className="font-medium">Caption:</span> {idea.captionStarter}</p>}
        </CardContent>
      </Card>
      <IdeaDialog open={editOpen} onClose={() => setEditOpen(false)} initial={idea} />
    </>
  )
}

export default function IdeasPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ideas', filterPlatform, filterStatus],
    queryFn: () => ideasApi.list({ platform: filterPlatform || undefined, status: filterStatus || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ideasApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ideas'] }); toast.success('Deleted') },
  })

  const generateMutation = useMutation({
    mutationFn: () => ideasApi.generate(5),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ideas'] }); toast.success('5 ideas generated') },
    onError: (e: Error) => toast.error(e.message),
  })

  const ideas = data?.ideas ?? []

  return (
    <>
      <PageHeader title="Ideas Bank" description="Capture, organize, and generate content ideas."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />{generateMutation.isPending ? 'Generating…' : 'Generate Ideas'}
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Idea</Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-[var(--color-text-4)]" />
        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All platforms" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All platforms</SelectItem>
            <SelectItem value="INSTAGRAM">Instagram</SelectItem>
            <SelectItem value="FACEBOOK">Facebook</SelectItem>
            <SelectItem value="YOUTUBE">YouTube</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="BACKLOG">Backlog</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="p-4"><div className="skeleton h-20 w-full rounded" /></CardContent></Card>)}
        </div>
      ) : ideas.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={<Lightbulb className="h-12 w-12" />} heading="No ideas yet" description="Add your ideas manually or let AI generate some based on your strategy." action={{ label: 'Generate Ideas', onClick: () => generateMutation.mutate() }} /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ideas.map(i => i.id ? <IdeaCard key={i.id} idea={i} onDelete={() => deleteMutation.mutate(i.id!)} /> : null)}
        </div>
      )}
      <IdeaDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
