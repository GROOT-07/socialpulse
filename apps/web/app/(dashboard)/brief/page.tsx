'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, CheckSquare, RefreshCw, Clock } from 'lucide-react'
import { briefApi } from '@/lib/api'
import { useGeneratorStore } from '@/store/generator.store'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function DailyBriefPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const { setPrefill } = useGeneratorStore()
  const { data, isLoading } = useQuery({ queryKey: ['daily-brief'], queryFn: () => briefApi.today() })
  const generateMutation = useMutation({
    mutationFn: () => briefApi.generate(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['daily-brief'] }); toast.success('Brief generation queued — refresh in a moment') },
    onError: (e: Error) => toast.error(e.message),
  })
  const brief = data?.brief

  const handleUseIdea = () => {
    if (brief?.ideaOfDay) {
      setPrefill({
        topic: brief.ideaOfDay ?? brief.summary,
        context: `From daily brief: ${brief.summary}`,
        source: 'brief',
        shouldFocus: true,
      })
      router.push('/studio/posts')
    }
  }

  return (
    <>
      <PageHeader title="Daily Brief" description="Your AI-generated daily social media summary."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => qc.invalidateQueries({ queryKey: ['daily-brief'] })}><RefreshCw className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />{generateMutation.isPending ? 'Queuing…' : 'Regenerate'}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-5"><div className="skeleton h-16 w-full rounded" /></CardContent></Card>)}
        </div>
      ) : !brief ? (
        <Card><CardContent className="p-0">
          <EmptyState
            icon={<Sparkles className="h-12 w-12" />}
            heading="No brief for today"
            description="Generate your daily brief to get an AI summary of your performance, competitor activity, and action items."
            action={{ label: 'Generate Brief', onClick: () => generateMutation.mutate() }}
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(brief.briefDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Badge>
            <Badge variant="outline" className="text-xs bg-accent-light text-accent border-accent/20 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />AI Generated
            </Badge>
          </div>

          {brief.summary && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-accent" />Performance Summary</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed text-[var(--color-text-2)]">{brief.summary}</p></CardContent>
            </Card>
          )}

          {brief.topPerformer && (
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-success"><TrendingUp className="h-4 w-4" />Top Performer</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-[var(--color-text-2)]">{brief.topPerformer}</p></CardContent>
            </Card>
          )}

          {brief.competitorAlert && (
            <Card className="border-warning/30 bg-warning/5">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" />Competitor Alert</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-[var(--color-text-2)]">{brief.competitorAlert}</p></CardContent>
            </Card>
          )}

          {brief.ideaOfDay && (
            <Card className="border-accent/30 bg-accent/5">
              <CardHeader className="pb-2 flex items-center justify-between"><CardTitle className="text-sm flex items-center gap-2 text-accent"><Lightbulb className="h-4 w-4" />Idea of the Day</CardTitle><Button size="sm" variant="default" onClick={handleUseIdea}>Use this idea</Button></CardHeader>
              <CardContent><p className="text-sm text-[var(--color-text-2)]">{brief.ideaOfDay}</p></CardContent>
            </Card>
          )}

          {brief.actionItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckSquare className="h-4 w-4 text-accent" />Action Items</CardTitle></CardHeader>
              <CardContent>
 