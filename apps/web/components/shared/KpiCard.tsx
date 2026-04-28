import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface KpiCardProps {
  label: string
  value: string | number
  delta?: number          // signed number — positive = up
  deltaLabel?: string     // e.g. "vs last week"
  format?: 'number' | 'percent' | 'raw'
  icon?: React.ReactNode
  loading?: boolean
}

function SkeletonKpi() {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-9 w-32 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </CardContent>
    </Card>
  )
}

export function KpiCard({ label, value, delta, deltaLabel = 'vs last week', format = 'number', icon, loading }: KpiCardProps) {
  if (loading) return <SkeletonKpi />

  const formattedValue =
    format === 'percent'
      ? formatPercent(Number(value))
      : format === 'number'
      ? formatNumber(Number(value))
      : String(value)

  const deltaSign = delta === undefined ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'

  return (
    <Card className="transition-[border-color,transform] duration-fast hover:-translate-y-px hover:border-brand-border-2">
      <CardContent className="p-6">
        {/* Label row */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-4)]">
            {label}
          </p>
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded bg-accent-light text-accent">
              {icon}
            </span>
          )}
        </div>

        {/* Value */}
        <p className="font-mono text-3xl font-bold tabular-nums text-[var(--color-text)]">
          {formattedValue}
        </p>

        {/* Delta */}
        {delta !== undefined && (
          <div className={cn('mt-2 flex items-center gap-1 text-sm', {
            'text-success': deltaSign === 'up',
            'text-danger':  deltaSign === 'down',
            'text-[var(--color-text-4)]': deltaSign === 'neutral',
          })}>
            {deltaSign === 'up' && <TrendingUp className="h-4 w-4" aria-hidden="true" />}
            {deltaSign === 'down' && <TrendingDown className="h-4 w-4" aria-hidden="true" />}
            {deltaSign === 'neutral' && <Minus className="h-4 w-4" aria-hidden="true" />}
            <span className="font-medium">
              {delta > 0 ? '+' : ''}{format === 'percent' ? formatPercent(delta) : formatNumber(delta)}
            </span>
            <span className="text-[var(--color-text-4)]">{deltaLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
