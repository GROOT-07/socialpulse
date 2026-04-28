'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Instagram, Facebook, Youtube, CalendarDays } from 'lucide-react'
import { calendarApi, type CalendarPost } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

const STATUS_STYLES: Record<string, string> = {
  PLANNED:   'bg-accent-light text-accent',
  PUBLISHED: 'bg-success/10 text-success',
  SKIPPED:   'bg-surface-2 text-[var(--color-text-4)]',
}

type PostForm = {
  date: string; time: string; platform: string; topic: string
  contentPillar: string; format: string; caption: string; notes: string; status: string
}
const EMPTY_FORM: PostForm = {
  date: '', time: '09:00', platform: 'INSTAGRAM', topic: '', contentPillar: '',
  format: 'POST', caption: '', notes: '', status: 'PLANNED',
}

function PostDialog({ open, onClose, initial, defaultDate }: {
  open: boolean; onClose: () => void; initial?: CalendarPost; defaultDate?: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<PostForm>(
    initial
      ? {
          date: initial.date.slice(0, 10),
          time: initial.time ?? '09:00',
          platform: initial.platform,
          topic: initial.topic,
          contentPillar: initial.contentPillar ?? '',
          format: initial.format,
          caption: initial.caption ?? '',
          notes: initial.notes ?? '',
          status: initial.status,
        }
      : { ...EMPTY_FORM, date: defaultDate ?? '' },
  )
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        date: form.date,
        time: form.time || null,
        platform: form.platform,
        topic: form.topic,
        contentPillar: form.contentPillar || null,
        format: form.format as CalendarPost['format'],
        caption: form.caption || null,
        notes: form.notes || null,
        status: form.status as CalendarPost['status'],
      }
      return initial ? calendarApi.update(initial.id, payload) : calendarApi.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast.success(initial ? 'Updated' : 'Created'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  const f = (k: keyof PostForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? 'Edit Post' : 'New Post'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Topic / Title</Label><Input value={form.topic} onChange={f('topic')} placeholder="What's this post about?" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={f('date')} /></div>
            <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={form.time} onChange={f('time')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm(p => ({ ...p, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="FACEBOOK">Facebook</SelectItem>
                  <SelectItem value="YOUTUBE">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={form.format} onValueChange={v => setForm(p => ({ ...p, format: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">Post</SelectItem>
                  <SelectItem value="REEL">Reel</SelectItem>
                  <SelectItem value="CAROUSEL">Carousel</SelectItem>
                  <SelectItem value="STORY">Story</SelectItem>
                  <SelectItem value="SHORT">Short</SelectItem>
                  <SelectItem value="VIDEO">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="SKIPPED">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Content Pillar</Label><Input value={form.contentPillar} onChange={f('contentPillar')} placeholder="Optional" /></div>
          </div>
          <div className="space-y-1.5"><Label>Caption</Label><Textarea value={form.caption} onChange={f('caption')} className="resize-none h-20 text-sm" placeholder="What will you say?" /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={f('notes')} placeholder="Internal notes…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.topic || !form.date || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPage() {
  const qc = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [addOpen, setAddOpen] = useState(false)
  const [defaultDate, setDefaultDate] = useState<string>()
  const [editPost, setEditPost] = useState<CalendarPost>()

  const from = new Date(year, month, 1).toISOString().slice(0, 10)
  const to = new Date(year, month + 1, 0).toISOString().slice(0, 10)

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => calendarApi.list(from, to),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calendarApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast.success('Deleted') },
  })

  const posts = data?.posts ?? []
  const postsByDate: Record<string, CalendarPost[]> = {}
  posts.forEach(p => {
    const key = p.date.slice(0, 10)
    if (!postsByDate[key]) postsByDate[key] = []
    postsByDate[key].push(p)
  })

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  return (
    <>
      <PageHeader title="Content Calendar" description="Plan and track your content schedule."
        actions={
          <Button size="sm" onClick={() => { setDefaultDate(undefined); setAddOpen(true) }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />New Post
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          {/* Month nav */}
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">{MONTH_NAMES[month]} {year}</h2>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {isLoading ? (
            <div className="skeleton h-64 w-full rounded" />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayPosts = postsByDate[dateKey] ?? []
                const isToday = dateKey === now.toISOString().slice(0, 10)
                return (
                  <div
                    key={day}
                    className={cn(
                      'min-h-[80px] rounded-lg border border-brand-border p-1.5 cursor-pointer hover:border-brand-border-2 transition-colors',
                      isToday && 'border-accent/50 bg-accent-light/30',
                    )}
                    onClick={() => { setDefaultDate(dateKey); setAddOpen(true) }}
                  >
                    <p className={cn('mb-1 text-xs font-medium', isToday ? 'text-accent' : 'text-[var(--color-text-4)]')}>{day}</p>
                    <div className="space-y-0.5" onClick={e => e.stopPropagation()}>
                      {dayPosts.slice(0, 3).map(post => {
                        const color = PLATFORM_COLORS[post.platform] ?? 'var(--color-text-4)'
                        const PIcon = PLATFORM_ICONS[post.platform]
                        return (
                          <div
                            key={post.id}
                            className="group flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-surface-2"
                            style={{ borderLeft: `2px solid ${color}` }}
                          >
                            {PIcon && <PIcon className="h-2.5 w-2.5 shrink-0" style={{ color }} />}
                            <span className="flex-1 truncate text-[var(--color-text-2)]">{post.topic}</span>
                            <div className="hidden gap-0.5 group-hover:flex">
                              <button className="p-0.5 hover:text-accent" onClick={() => setEditPost(post)}><Pencil className="h-2.5 w-2.5" /></button>
                              <button className="p-0.5 hover:text-danger" onClick={() => deleteMutation.mutate(post.id)}><Trash2 className="h-2.5 w-2.5" /></button>
                            </div>
                          </div>
                        )
                      })}
                      {dayPosts.length > 3 && (
                        <p className="text-[10px] text-[var(--color-text-4)] pl-1">+{dayPosts.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-[var(--color-text-4)]">
        <CalendarDays className="h-3.5 w-3.5" />
        {Object.entries(STATUS_STYLES).map(([status, cls]) => (
          <span key={status} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{status}</span>
        ))}
      </div>

      <PostDialog open={addOpen || !!editPost} onClose={() => { setAddOpen(false); setEditPost(undefined) }}
        initial={editPost} defaultDate={defaultDate} />
    </>
  )
}
