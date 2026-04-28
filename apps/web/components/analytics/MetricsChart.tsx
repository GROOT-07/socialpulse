'use client'

import React from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MetricPoint } from '@/lib/api'
import { formatNumber, formatPercent } from '@/lib/utils'

// ── Custom tooltip ─────────────────────────────────────────────

interface TooltipPayload {
  name: string
  value: number
  color: string
  unit?: string
}

function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  formatter?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-brand-border-2 bg-surface p-3 shadow-md text-sm min-w-[140px]">
      <p className="mb-2 font-medium text-[var(--color-text)] text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 text-[var(--color-text-2)]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="capitalize text-xs">{p.name}</span>
          </div>
          <span className="font-mono font-semibold text-xs text-[var(--color-text)]">
            {formatter ? formatter(p.value) : formatNumber(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="skeleton h-3 w-32 rounded" />
      </CardHeader>
      <CardContent>
        <div className="skeleton h-[220px] w-full rounded" />
      </CardContent>
    </Card>
  )
}

// ── Follower trend line chart ──────────────────────────────────

interface FollowerChartProps {
  data: MetricPoint[]
  loading?: boolean
  color?: string
}

export function FollowerTrendChart({ data, loading, color = 'var(--chart-1)' }: FollowerChartProps) {
  if (loading) return <ChartSkeleton />

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-3)]">
          Follower growth
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
            <ReTooltip content={<CustomTooltip formatter={formatNumber} />} />
            <Line type="monotone" dataKey="followers" name="Followers" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Engagement rate line chart ─────────────────────────────────

interface EngagementChartProps {
  data: MetricPoint[]
  loading?: boolean
  color?: string
}

export function EngagementChart({ data, loading, color = 'var(--chart-2)' }: EngagementChartProps) {
  if (loading) return <ChartSkeleton />

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-3)]">
          Engagement rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <ReTooltip content={<CustomTooltip formatter={formatPercent} />} />
            <Line type="monotone" dataKey="engagementRate" name="Engagement" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Reach + impressions bar chart ──────────────────────────────

interface ReachChartProps {
  data: MetricPoint[]
  loading?: boolean
}

export function ReachImpressionsChart({ data, loading }: ReachChartProps) {
  if (loading) return <ChartSkeleton />

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-3)]">
          Reach &amp; impressions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
            <ReTooltip content={<CustomTooltip formatter={formatNumber} />} />
            <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs capitalize text-[var(--color-text-3)]">{v}</span>} />
            <Bar dataKey="reach" name="Reach" fill="var(--chart-3)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="impressions" name="Impressions" fill="var(--chart-4)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Avg likes + comments bar chart ────────────────────────────

interface EngagementBreakdownProps {
  data: MetricPoint[]
  loading?: boolean
}

export function EngagementBreakdownChart({ data, loading }: EngagementBreakdownProps) {
  if (loading) return <ChartSkeleton />

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-3)]">
          Avg likes &amp; comments per post
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
            <ReTooltip content={<CustomTooltip formatter={(v) => v.toFixed(1)} />} />
            <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs capitalize text-[var(--color-text-3)]">{v}</span>} />
            <Bar dataKey="avgLikes" name="Likes" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="avgComments" name="Comments" fill="var(--chart-5)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
