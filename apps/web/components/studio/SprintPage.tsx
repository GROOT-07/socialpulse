'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, RefreshCw, Copy, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import { sprintApi, type SprintPlan, type SprintWeek, type PlatformBrief } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface ExpandedCaptions {
  [key: string]: boolean
}

export function SprintPage() {
  const queryClient = useQueryClient()
  const [expandedCaptions, setExpandedCaptions] = useState<ExpandedCaptions>({})
  const [generatingWeeks, setGeneratingWeeks] = useState<Set<number>>(new Set())
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const { data: sprint, isLoading, error } = useQuery({
    queryKey: ['sprint', 'latest'],
    queryFn: () => sprintApi.getLatest(),
  })

  const generateMutation = useMutation({
    mutationFn: (date?: string) => sprintApi.generate(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', 'latest'] })
      setShowGenerateDialog(false)
      setStartDate('')
      setIsGenerating(false)
    },
    onError: () => {
      setIsGenerating(false)
    },
  })

  const regenerateWeekMutation = useMutation({
    mutationFn: ({ sprintId, weekNumber }: { sprintId: string; weekNumber: number }) =>
      sprintApi.regenerateWeek(sprintId, weekNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', 'latest'] })
      setGeneratingWeeks((prev) => {
        const newSet = new Set(prev)
        newSet.clear()
        return newSet
      })
    },
  })

  const handleGenerateSprint = () => {
    setIsGenerating(true)
    generateMutation.mutate(startDate || undefined)
  }

  const handleRegenerateWeek = (sprintId: string, weekNumber: number) => {
    setGeneratingWeeks((prev) => new Set(prev).add(weekNumber))
    regenerateWeekMutation.mutate({ sprintId, weekNumber })
  }

  const toggleCaptionExpanded = (key: string) => {
    setExpandedCaptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleUseIdea = (platform: string, hook: string, caption: string, hashtags: string[]) => {
    const text = `${hook}\n\n${caption}\n\n${hashtags.join(' ')}`
    navigator.clipboard.writeText(text)

    window.dispatchEvent(
      new CustomEvent('sprint:use-idea', {
        detail: { platform, hook, caption, hashtags },
      }),
    )
  }

  const formatDateRange = (startDate: string, weekNumber: number): string => {
    const start = new Date(startDate)
    start.setDate(start.getDate() + (weekNumber - 1) * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${startStr} - ${endStr}`
  }

  const getPlatformColor = (platform: string): string => {
    const lower = platform.toLowerCase()
    if (lower === 'instagram') return 'bg-pink-100 text-pink-900 dark:bg-pink-900 dark:text-pink-100'
    if (lower === 'facebook') return 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
    if (lower === 'youtube') return 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100'
    return 'bg-[var(--color-surface-2)] text-[var(--color-text)]'
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="8-Week Sprint" icon={Zap} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="space-y-2">
                  <div className="h-4 w-20 bg-[var(--color-surface-2)] rounded animate-pulse" />
                  <div className="h-5 w-40 bg-[var(--color-surface-2)] rounded animate-pulse" />
                  <div className="h-3 w-32 bg-[var(--color-surface-2)] rounded animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-3 w-full bg-[var(--color-surface-2)] rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-[var(--color-surface-2)] rounded animate-pulse" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-2 w-full bg-[var(--color-surface-2)] rounded animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="8-Week Sprint" icon={Zap} />
        <Card className="border-[var(--color-danger)] bg-[var(--color-surface)]">
          <CardContent className="p-4">
            <p className="text-[var(--color-danger)] text-sm">
              Failed to load sprint. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!sprint) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="8-Week Sprint"
          description="AI-generated weekly content themes tailored to your business"
          icon={Zap}
          actions={
            <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
              <DialogTrigger asChild>
                <Button>Generate New Sprint</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate 8-Week Sprint</DialogTitle>
                  <DialogDescription>
                    This will create an AI-powered 8-week content sprint with weekly themes and platform-specific ideas.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[var(--color-text)]">
                      Start Date (optional)
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Button
                    onClick={handleGenerateSprint}
                    disabled={isGenerating}
                    className="w-full"
                  >
                    {isGenerating ? 'Generating...' : 'Generate Sprint'}
                  </Button>
                  {isGenerating && (
                    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-3 text-center">
                      <p className="text-sm text-[var(--color-text-3)]">
                        Generating your 8-week sprint... This takes ~30 seconds
                      </p>
                      <div className="mt-2 h-1 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--color-accent)] rounded-full animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          }
        />
        <EmptyState
          icon={Zap}
          heading="No sprint plan yet"
          description="Generate your first 8-week content sprint"
          action={{
            label: 'Generate Sprint',
            href: '#',
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="8-Week Sprint"
        description="AI-generated weekly content themes tailored to your business"
        icon={Zap}
        actions={
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button>Generate New Sprint</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate 8-Week Sprint</DialogTitle>
                <DialogDescription>
                  This will create an AI-powered 8-week content sprint with weekly themes and platform-specific ideas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--color-text)]">
                    Start Date (optional)
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button
                  onClick={handleGenerateSprint}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? 'Generating...' : 'Generate Sprint'}
                </Button>
                {isGenerating && (
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-3 text-center">
                    <p className="text-sm text-[var(--color-text-3)]">
                      Generating your 8-week sprint... This takes ~30 seconds
                    </p>
                    <div className="mt-2 h-1 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--color-accent)] rounded-full animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sprint.weeks.map((week) => (
          <Card key={week.id} className="relative overflow-hidden">
            {generatingWeeks.has(week.weekNumber) && (
              <div className="absolute inset-0 bg-[var(--color-surface)] bg-opacity-50 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-[var(--color-text-3)]">Regenerating...</p>
                </div>
              </div>
            )}

            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="accent">Week {week.weekNumber}</Badge>
                    <span className="text-xs text-[var(--color-text-3)]">
                      {formatDateRange(sprint.startDate, week.weekNumber)}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--color-text)] truncate">
                    {week.theme}
                  </h3>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRegenerateWeek(sprint.id, week.weekNumber)}
                  disabled={generatingWeeks.has(week.weekNumber)}
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="bg-[var(--color-surface-2)] rounded p-3">
                <p className="text-sm italic text-[var(--color-text-2)]">
                  {week.whyNow}
                </p>
              </div>

              {week.notableDates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {week.notableDates.map((date, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {date}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {Object.entries(week.platforms).map(([platform, brief]) => (
                  <div key={platform} className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${getPlatformColor(
                          platform,
                        )}`}
                      >
                        {platform}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)] line-clamp-1">
                        {brief.hook}
                      </p>
                    </div>

                    <ul className="space-y-1">
                      {brief.points.map((point, i) => (
                        <li
                          key={i}
                          className="text-xs text-[var(--color-text-3)] flex gap-2 items-start"
                        >
                          <span className="shrink-0 mt-1 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="space-y-1">
                      <div
                        className="flex items-start justify-between gap-2 cursor-pointer hover:opacity-80"
                        onClick={() =>
                          toggleCaptionExpanded(`${week.id}-${platform}`)
                        }
                      >
                        <p className="text-xs font-medium text-[var(--color-text-2)]">
                          Caption Preview
                        </p>
                        {expandedCaptions[`${week.id}-${platform}`] ? (
                          <ChevronUp className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-xs text-[var(--color-text-3)] ${
                          expandedCaptions[`${week.id}-${platform}`]
                            ? ''
                            : 'line-clamp-2'
                        }`}
                      >
                        {brief.caption}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {brief.hashtags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-text-3)] rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleUseIdea(
                          platform,
                          brief.hook,
                          brief.caption,
                          brief.hashtags,
                        )
                      }
                      className="text-xs h-6 w-full justify-center"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Use this idea
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
