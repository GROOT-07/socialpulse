'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, RefreshCw, ArrowLeft, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react'
import Link from 'next/link'
import { aiApi } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

function AnalysisSection({ title, content, icon }: { title: string; content: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-light text-accent">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-text-2)] whitespace-pre-wrap">{content}</p>
    </div>
  )
}

function parseAnalysisContent(content: string): Record<string, string> {
  // Try to parse structured JSON content, fall back to single block
  try {
    return JSON.parse(content) as Record<string, string>
  } catch {
    return { summary: content }
  }
}

export default function GapAnalysisPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['gap-analysis'],
    queryFn: () => aiApi.gapAnalysis(),
  })

  const generate = useMutation({
    mutationFn: () => aiApi.gapAnalysis(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gap-analysis'] })
      toast.success('Gap analysis regenerated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const analysis = data?.analysis
  const parsed = analysis ? parseAnalysisContent(analysis.content) : null

  const SECTIONS = [
    { key: 'opportunities', title: 'Content Opportunities', icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { key: 'gaps', title: 'Your Gaps vs Competitors', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { key: 'strengths', title: 'Your Strengths to Leverage', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: 'recommendations', title: 'Recommendations', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { key: 'summary', title: 'Summary', icon: <Sparkles className="h-3.5 w-3.5" /> },
  ]

  return (
    <>
      <PageHeader
        title="Gap Analysis"
        description="AI-powered competitive gap analysis based on your metrics vs competitors."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/competitors"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back</Button></Link>
            <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {generate.isPending ? 'Generating…' : 'Regenerate'}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-brand-border p-5 space-y-2">
              <div className="skeleton h-3 w-40 rounded" />
              <div className="skeleton h-16 w-full rounded" />
            </div>
          ))}
        </div>
      ) : !analysis ? (
        <Card><CardContent className="p-0">
          <EmptyState
            icon={<Sparkles className="h-12 w-12" />}
            heading="No analysis yet"
            description="Generate a gap analysis to discover content opportunities and areas where competitors are outperforming you."
            action={{ label: 'Generate Analysis', onClick: () => generate.mutate() }}
          />
        </CardContent></Card>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Generated {new Date(analysis.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Badge>
            <Badge variant="outline" className="text-xs bg-accent-light text-accent border-accent/20">
              <Sparkles className="mr-1 h-3 w-3" /> AI Generated
            </Badge>
          </div>
          <div className="space-y-4">
            {parsed && SECTIONS.filter(s => parsed[s.key]).map(s => (
              <AnalysisSection key={s.key} title={s.title} content={parsed[s.key]} icon={s.icon} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
