'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Target, CheckCircle2, Clock, XCircle, Pencil } from 'lucide-react'
import { strategyApi, type Goal } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatNumber } from '@/lib/utils'
import { toast } from 'sonner'

const STATUS_STYLES: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  ACTIVE:   { label: 'Active',   icon: Clock,        cls: 'text-accent' },
  ACHIEVED: { label: 'Achieved', icon: CheckCircle2, cls: 'text-success' },
  MISSED:   { label: 'Missed',   icon: XCircle,      cls: 'text-danger' },
}

type GoalFormData = {
  title: string; description: string; platform: string; metric: string
  targetValue: string; currentValue: string; unit: string; dueDate: string; status: string
}

const EMPTY_FORM: GoalFormData = {
  title: '', description: '', platform: '', metric: 'followers',
  targetValue: '', currentValue: '', unit: '', dueDate: '', status: 'ACTIVE',
}

function GoalDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Goal }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<GoalFormData>(
    initial ? {
      title: initial.title, description: initial.description ?? '',
      platform: initial.platform ?? '', metric: initial.metric ?? 'followers',
      targetValue: String(initial.targetValue ?? ''),
      currentValue: String(initial.currentValue ?? ''), unit: initial.unit ?? '',
      dueDate: initial.dueDate ? initial.dueDate.slice(0, 10) : '', status: initial.status,
    } : EMPTY_FORM,
  )

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title, description: form.description || null,
        platform: form.platform || null,
        metric: form.metric || 'followers',
        targetValue: form.targetValue ? Number(form.targetValue) : 0,
        currentValue: form.currentValue ? Number(form.currentValue) : 0,
        unit: form.unit || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        status: form.status,
      }
      return initial ? strategyApi.updateGoal(initial.id, payload) : strategyApi.createGoal(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success(initial ? 'Goal updated' : 'Goal created')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const f = (key: keyof GoalFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'Edit Goal' : 'New Goal'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={f('title')} placeholder="Reach 10K followers on Instagram" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={f('description')} /></div>
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
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ACHIEVED">Achieved</SelectItem>
                  <SelectItem value="MISSED">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Metric</Label><Input value={form.metric} onChange={f('metric')} placeholder="followers, engagementRate…" /></div>
            <div className="space-y-1.5"><Label>Unit</Label><Input value={form.unit} onChange={f('unit')} placeholder="followers, %, views…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Target Value</Label><Input type="number" value={form.targetValue} onChange={f('targetValue')} placeholder="10000" /></div>
            <div className="space-y-1.5"><Label>Current Value</Label><Input type="number" value={form.currentValue} onChange={f('currentValue')} placeholder="0" /></div>
          </div>
          <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={f('dueDate')} /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.title || mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const s = STATUS_STYLES[goal.status] ?? STATUS_STYLES.ACTIVE
  const Icon = s.icon
  const pct = goal.targetValue && goal.currentValue
    ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)) : null

  return (
    <>
      <Card className="flex flex-col gap-0">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${s.cls}`} />
                <span className={`text-xs font-medium ${s.cls}`}>{s.label}</span>
                {goal.platform && <Badge variant="outline" className="text-[10px] h-4 px-1">{goal.platform}</Badge>}
                {goal.metric && <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">{goal.metric}</Badge>}
              </div>
              <p className="font-semibold text-sm text-[var(--color-text)]">{goal.title}</p>
              {goal.description && <p className="mt-0.5 text-xs text-[var(--color-text-4)]">{goal.description}</p>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditOpen(true)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger hover:text-danger" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          {pct !== null && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-4)]">{formatNumber(goal.currentValue!)} / {formatNumber(goal.targetValue!)} {goal.unit}</span>
                <span className="font-mono font-semibold text-[var(--color-text)]">{pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-2">
                <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {goal.dueDate && (
            <p className="mt-2 text-[10px] text-[var(--color-text-4)]">
              Due {new Date(goal.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </CardContent>
      </Card>
      <GoalDialog open={editOpen} onClose={() => setEditOpen(false)} initial={goal} />
    </>
  )
}

export default function GoalsPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => strategyApi.listGoals() })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => strategyApi.deleteGoal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast.success('Goal deleted') },
  })

  const goals = data?.goals ?? []

  return (
    <>
      <PageHeader title="Goals" description="Set and track measurable social media goals."
        actions={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Goal</Button>}
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><div className="skeleton h-20 w-full rounded" /></CardContent></Card>)}
        </div>
      ) : goals.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={<Target className="h-12 w-12" />} heading="No goals yet" description="Create your first goal to start tracking progress." action={{ label: 'New Goal', onClick: () => setAddOpen(true) }} /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map(g => <GoalCard key={g.id} goal={g} onDelete={() => deleteMutation.mutate(g.id)} />)}
        </div>
      )}
      <GoalDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
