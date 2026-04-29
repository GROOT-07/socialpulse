'use client'

import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays, Sparkles, Loader2, Instagram, Facebook, Youtube,
  MessageCircle, ChevronLeft, ChevronRight, Star, Zap, Search, Flame,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { calendarApi, apiClient, type CalendarPost } from '@/lib/api'
import { toast } from 'sonner'

// ── Platform helpers ──────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  YOUTUBE: Youtube,
  WHATSAPP: MessageCircle,
}

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: 'var(--platform-instagram)',
  FACEBOOK: 'var(--platform-facebook)',
  YOUTUBE: 'var(--platform-youtube)',
  WHATSAPP: 'var(--platform-whatsapp)',
}

function getFormatColor(format: string): string {
  if (format === 'REEL' || format === 'VIDEO' || format === 'SHORT') return 'var(--platform-youtube)'
  if (format === 'CAROUSEL') return 'var(--color-info)'
  if (format === 'STORY') return 'var(--platform-instagram)'
  return 'var(--color-accent)'
}

// ── Day cell ──────────────────────────────────────────────────

function DayCell({
  date,
  posts,
  isCurrentMonth,
  isToday,
}: {
  date: Date
  posts: CalendarPost[]
  isCurrentMonth: boolean
  isToday: boolean
}) {
  return (
    <div
      className={cn(
        'min-h-[110px] rounded-lg border p-2 transition-colors',
        isCurrentMonth ? 'bg-[var(--color-surface)] border-[var(--color-border)]' : 'bg-[var(--color-surface-2)] border-transparent',
        isToday && 'ring-2 ring-[var(--color-accent)] ring-inset',
      )}
    >
      {/* Date number */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={cn(
            'text-xs font-semibold',
            isToday ? 'text-[var(--color-accent)]' : isCurrentMonth ? 'text-[var(--color-text-2)]' : 'text-[var(--color-text-4)]',
          )}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Posts */}
      <div className="space-y-1">
        {posts.slice(0, 3).map((post, i) => {
          const Icon = PLATFORM_ICONS[post.platform]
          const color = PLATFORM_COLORS[post.platform] ?? 'var(--color-accent)'
          return (
            <div
              key={i}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] truncate cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: `${color}18`, color }}
              title={`[${post.format}] ${post.topic}`}
            >
              {Icon && <Icon className="h-2.5 w-2.5 shrink-0" />}
              <span className="truncate">{post.topic}</span>
            </div>
          )
        })}
        {posts.length > 3 && (
          <div className="text-[9px] text-[var(--color-text-4)] pl-1">+{posts.length - 3} more</div>
        )}
        {posts.length === 0 && isCurrentMonth && (
          <div className="text-[9px] text-[var(--color-text-4)] pl-0.5 pt-1">No posts</div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function SmartCalendarPage() {
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''
  const queryClient = useQueryClient()

  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  // Calendar posts from DB
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['calendar', orgId, currentMonth, currentYear],
    queryFn: () => {
      const from = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]!
      const to = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]!
      return calendarApi.list(from, to)
    },
    enabled: !!orgId,
  })

  const posts = calendarData?.posts ?? []

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ generated: number; daysAhead: number }>('/api/calendar/generate', { days: 30 }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['calendar', orgId] })
      toast.success(`Generated ${res.generated ?? 0} posts for the next 30 days`)
    },
    onError: () => toast.error('Calendar generation failed. Please try again.'),
  })

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1)
  const lastDay = new Date(currentYear, currentMonth + 1, 0)
  const startDow = firstDay.getDay() // 0=Sun
  const daysInMonth = lastDay.getDate()

  const cells: Date[] = []
  for (let i = 0; i < startDow; i++) {
    const d = new Date(currentYear, currentMonth, -startDow + i + 1)
    cells.push(d)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(currentYear, currentMonth, d))
  }
  while (cells.length % 7 !== 0) {
    cells.push(new Date(currentYear, currentMonth + 1, cells.length - startDow - daysInMonth + 1))
  }

  function postsForDate(dateStr: string): CalendarPost[] {
    return posts.filter((p) => p.date.split('T')[0] === dateStr)
  }

  const monthLabel = new Date(currentYear, currentMonth).toLocaleString('en', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) }
    else setCurrentMonth(currentMonth - 1)
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) }
    else setCurrentMonth(currentMonth + 1)
  }

  return (
    <div className="px-7 py-7 max-w-[1280px] mx-auto">
      <PageHeader
        title="Smart Calendar"
        description="AI-powered content calendar with special days, trends, and SEO slots auto-populated"
        icon={<CalendarDays className="h-5 w-5" />}
      />

      {/* Controls bar */}
      <div className="mt-6 flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors">
            <ChevronLeft className="h-4 w-4 text-[var(--color-text-3)]" />
          </button>
          <h2 className="text-base font-semibold text-[var(--color-text)] min-w-[160px] text-center">{monthLabel}</h2>
          <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors">
            <ChevronRight className="h-4 w-4 text-[var(--color-text-3)]" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="gap-2"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> AI Generate (30 days)</>
            )}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {[
          { color: 'var(--platform-instagram)', label: 'Instagram' },
          { color: 'var(--platform-facebook)', label: 'Facebook' },
          { color: 'var(--platform-youtube)', label: 'YouTube' },
          { color: 'var(--color-warning)', label: '⭐ Special day' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-[var(--color-text-4)]">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-4)]">
              {day}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 gap-px bg-[var(--color-border)] p-px">
          {cells.map((date, i) => {
            const dateStr = date.toISOString().split('T')[0]
            const isCurrentMonth = date.getMonth() === currentMonth
            const isToday = dateStr === today.toISOString().split('T')[0]
            return (
              <div key={i} className="group">
                <DayCell
                  date={date}
                  posts={postsForDate(dateStr)}
                  isCurrentMonth={isCurrentMonth}
                  isToday={isToday}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={<CalendarDays className="h-10 w-10" />}
            title="No posts planned yet"
            description="Let AI generate a full 30-day content calendar tailored to your brand, platforms, and content pillars — including special days and trending topics."
            action={
              <Button className="gap-2" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                {generateMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  : <><Sparkles className="h-4 w-4" /> AI Generate Calendar</>}
              </Button>
            }
          />
        </div>
      )}
    </div>
  )
}
