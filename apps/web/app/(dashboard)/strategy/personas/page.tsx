'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Users, Pencil, Sparkles } from 'lucide-react'
import { strategyApi, aiApi, type Persona } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

type PersonaForm = {
  name: string
  ageRange: string
  gender: string
  location: string
  interests: string      // comma-separated input
  painPoints: string     // comma-separated input
  contentPreference: string
}

const EMPTY: PersonaForm = { name: '', ageRange: '', gender: '', location: '', interests: '', painPoints: '', contentPreference: '' }

function toArray(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

function toForm(p: Persona): PersonaForm {
  return {
    name: p.name,
    ageRange: p.ageRange ?? '',
    gender: p.gender ?? '',
    location: p.location ?? '',
    interests: p.interests.join(', '),
    painPoints: p.painPoints.join(', '),
    contentPreference: p.contentPreference ?? '',
  }
}

function PersonaDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Persona }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<PersonaForm>(initial ? toForm(initial) : EMPTY)
  const [genPrompt, setGenPrompt] = useState('')
  const [genOpen, setGenOpen] = useState(false)

  const aiMutation = useMutation({
    mutationFn: () => aiApi.generatePersona(genPrompt),
    onSuccess: ({ persona }) => {
      setForm(prev => ({
        ...prev,
        name: persona.name ?? prev.name,
        ageRange: persona.ageRange ?? prev.ageRange,
        gender: persona.gender ?? prev.gender,
        location: persona.location ?? prev.location,
        interests: persona.interests ? persona.interests.join(', ') : prev.interests,
        painPoints: persona.painPoints ? persona.painPoints.join(', ') : prev.painPoints,
        contentPreference: persona.contentPreference ?? prev.contentPreference,
      }))
      setGenOpen(false)
      toast.success('Persona generated — review and save')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        ageRange: form.ageRange || undefined,
        gender: form.gender || undefined,
        location: form.location || undefined,
        interests: toArray(form.interests),
        painPoints: toArray(form.painPoints),
        contentPreference: form.contentPreference || undefined,
      }
      return initial ? strategyApi.updatePersona(initial.id, payload) : strategyApi.createPersona(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personas'] })
      toast.success(initial ? 'Updated' : 'Created')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const f = (k: keyof PersonaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? 'Edit Persona' : 'New Persona'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>Persona Name *</Label>
              <Input value={form.name} onChange={f('name')} placeholder="The Aspiring Entrepreneur" />
            </div>
            {!initial && (
              <div className="flex items-end">
                <Button variant="secondary" size="sm" className="h-9 gap-1.5" onClick={() => setGenOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5" />AI
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Age Range</Label>
              <Input value={form.ageRange} onChange={f('ageRange')} placeholder="25–34" />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Input value={form.gender} onChange={f('gender')} placeholder="Any" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={f('location')} placeholder="Urban US, major cities" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Interests <span className="text-[var(--color-text-4)] font-normal">(comma-separated)</span></Label>
            <Textarea value={form.interests} onChange={f('interests')} placeholder="marketing, entrepreneurship, productivity, tech" className="h-16 text-sm resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label>Pain Points <span className="text-[var(--color-text-4)] font-normal">(comma-separated)</span></Label>
            <Textarea value={form.painPoints} onChange={f('painPoints')} placeholder="no time for marketing, overwhelmed by content creation" className="h-16 text-sm resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label>Content Preference</Label>
            <Textarea value={form.contentPreference} onChange={f('contentPreference')} placeholder="Short-form video, educational carousels, behind-the-scenes…" className="h-16 text-sm resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* AI Generation dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate with AI</DialogTitle></DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label>Describe your target audience</Label>
            <Textarea
              value={genPrompt}
              onChange={e => setGenPrompt(e.target.value)}
              placeholder="Small business owners aged 30–45 in the US, interested in marketing automation"
              className="h-24 text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={() => aiMutation.mutate()} disabled={!genPrompt || aiMutation.isPending}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {aiMutation.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

function PersonaCard({ persona, onDelete }: { persona: Persona; onDelete: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const initials = persona.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white font-semibold text-sm">{initials}</div>
              <div>
                <p className="font-semibold text-sm text-[var(--color-text)]">{persona.name}</p>
                {persona.ageRange && <p className="text-xs text-[var(--color-text-4)]">{persona.ageRange}{persona.gender ? ` · ${persona.gender}` : ''}</p>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditOpen(true)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger hover:text-danger" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="space-y-2">
            {persona.location && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">Location</p>
                <p className="text-xs text-[var(--color-text-2)]">{persona.location}</p>
              </div>
            )}
            {persona.interests.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">Interests</p>
                <p className="text-xs text-[var(--color-text-2)] line-clamp-2">{persona.interests.join(', ')}</p>
              </div>
            )}
            {persona.painPoints.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">Pain Points</p>
                <p className="text-xs text-[var(--color-text-2)] line-clamp-2">{persona.painPoints.join(', ')}</p>
              </div>
            )}
            {persona.contentPreference && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">Content Preference</p>
                <p className="text-xs text-[var(--color-text-2)] line-clamp-2">{persona.contentPreference}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <PersonaDialog open={editOpen} onClose={() => setEditOpen(false)} initial={persona} />
    </>
  )
}

export default function PersonasPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['personas'], queryFn: () => strategyApi.listPersonas() })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => strategyApi.deletePersona(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['personas'] }); toast.success('Deleted') },
    onError: (e: Error) => toast.error(e.message),
  })
  const personas = data?.personas ?? []

  return (
    <>
      <PageHeader title="Personas" description="Define your target audience profiles."
        actions={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Persona</Button>}
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="skeleton h-40 w-full rounded" /></CardContent></Card>
          ))}
        </div>
      ) : personas.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState icon={<Users className="h-12 w-12" />} heading="No personas yet"
            description="Define who you're talking to for more effective content."
            action={{ label: 'New Persona', onClick: () => setAddOpen(true) }} />
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {personas.map(p => <PersonaCard key={p.id} persona={p} onDelete={() => deleteMutation.mutate(p.id)} />)}
        </div>
      )}
      <PersonaDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
