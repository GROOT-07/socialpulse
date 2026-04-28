'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Users, TrendingUp, Eye, BarChart2, Lightbulb, RefreshCw,
  CheckSquare, CalendarDays, Sparkles, ArrowRight,
} from 'lucide-react'
import { metricsApi, competitorApi, briefApi, checklistApi, type KpiResponse } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/shared/KpiCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatNumber } from '@/lib/utils'

export default function DashboardPage() {
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['metrics', 'kpis'],
    queryFn: () => metricsApi.kpis(),
  })

  const { data: briefData } = useQuery({
    queryKey: ['daily-brief'],
    queryFn: () => briefApi.today(),
  })

  const { data: competitorData } = useQuery({
    queryKey: ['competitors'],
    queryFn: () => competitorApi.list(),
  })

  const { data: checklistData } = useQuery({
    queryKey: ['checklist'],
    queryFn: () => checklistApi.get(),
  })

  const kpis = (kpiData as KpiResponse | undefined)?.kpis
  const brief = briefData?.brief
  const competitors = competitorData?.competitors ?? []
  const checklistItems = checklistData?.items ?? []
  const checklistDone = checklistItems.filter(i => i.isDone).length
  const checklistPct = checklistItems.length > 0 ? Math.round((checklistDone / checklistItems.length) * 100) : 0

  return (
    <>
      <PageHeader title="Dashboard" description="Your social media performance at a glance." />

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total followers" value={kpis?.totalFollowers ?? 0} format="number" icon={<Users className="h-4 w-4" />} loading={kpiLoading} />
        <KpiCard label="Avg engagement rate" value={kpis?.avgEngagementRate ?? 0} format="percent" icon={<TrendingUp className="h-4 w-4" />} loading={kpiLoading} />
        <KpiCard label="Total reach" value={kpis?.totalReach ?? 0} format="number" icon={<Eye className="h-4 w-4" />} loading={kpiLoading} />
        <KpiCard label="Checklist progress" value={checklistPct} format="percent" icon={<CheckSquare className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Daily Brief card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />Daily Brief
              </CardTitle>
              <Link href="/brief">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">View <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {brief ? (
              <div className="space-y-3">
                {brief.summary && <p className="text-sm text-[var(--color-text-2)] line-clamp-3">{brief.summary}</p>}
                {brief.actionItems.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">Today&apos;s Actions</p>
                    {brief.actionItems.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">{i + 1}</span>
                        <p className="text-xs text-[var(--color-text-2)]">{item}</p>
                      </div>
                    ))}
                  </div>
                )}
                {brief.ideaOfDay && (
                  <div className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <p className="text-xs text-[var(--color-text-2)]">{brief.ideaOfDay}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<Sparkles className="h-8 w-8" />}
                heading="No brief today"
                description="Generate your daily brief to see AI insights."
                action={{ label: 'Generate', href: '/brief' }}
                className="py-6"
              />
            )}
          </CardContent>
        </Card>

        {/* Competitor snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-accent" />Competitor Snapshot
              </CardTitle>
              <Link href="/competitors">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">View all <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {competitors.length === 0 ? (
              <EmptyState
                icon={<BarChart2 className="h-8 w-8" />}
                heading="No competitors tracked"
                description="Add competitors to compare performance."
                action={{ label: 'Add Competitor', href: '/competitors' }}
                className="py-6"
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border bg-surface-2">
                    {['Account', 'Platform', 'Followers', 'Eng.'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-3)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {competitors.slice(0, 5).map(c => (
                    <tr key={c.id} className="border-b border-brand-border last:border-0 hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-2.5 text-xs font-medium text-[var(--color-text)]">{c.name}</td>
                      <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px] h-4 px-1">{c.platform}</Badge></td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-2)]">
                        {c.latestMetrics?.followers != null ? formatNumber(c.latestMetrics.followers) : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-2)]">
                        {c.latestMetrics?.engagementRate != null ? `${c.latestMetrics.engagementRate.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick links ── */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Analytics', href: '/analytics', icon: TrendingUp, desc: 'View metrics' },
          { label: 'Calendar', href: '/calendar', icon: CalendarDays, desc: 'Plan content' },
          { label: 'Ideas Bank', href: '/ideas', icon: Lightbulb, desc: 'Browse ideas' },
          { label: 'Playbook', href: '/playbook', icon: BarChart2, desc: 'Strategy docs' },
        ].map(({ label, href, icon: Icon, desc }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-brand-border-2 transition-colors cursor-pointer">
              <CardContent className="p-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-light text-accent shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text)]">{label}</p>
                  <p className="text-[10px] text-[var(--color-text-4)]">{desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
