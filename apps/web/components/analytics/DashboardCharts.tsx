'use client'

import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Mock 30-day engagement trend — replaced by real data in Phase 2
const TREND_DATA = [
  { date: 'Apr 1',  instagram: 4.2, facebook: 2.1, youtube: 5.8 },
  { date: 'Apr 5',  instagram: 4.5, facebook: 2.4, youtube: 6.1 },
  { date: 'Apr 10', instagram: 3.9, facebook: 2.0, youtube: 5.5 },
  { date: 'Apr 15', instagram: 5.1, facebook: 2.8, youtube: 6.4 },
  { date: 'Apr 20', instagram: 4.8, facebook: 3.1, youtube: 7.2 },
  { date: 'Apr 26', instagram: 4.7, facebook: 2.9, youtube: 6.9 },
]

// Platform follower distribution
const PLATFORM_DATA = [
  { name: 'Instagram', value: 28400, color: 'var(--platform-instagram)' },
  { name: 'Facebook',  value: 12300, color: 'var(--platform-facebook)'  },
  { name: 'YouTube',   value: 7500,  color: 'var(--platform-youtube)'   },
]

const CHART_COLORS = {
  instagram: 'var(--chart-1)',
  facebook:  'var(--chart-2)',
  youtube:   'var(--chart-3)',
}

// Per BRAND_GUIDELINES §12 — custom tooltip
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-brand-border-2 bg-surface p-3 shadow-md text-sm">
      <p className="mb-2 font-medium text-[var(--color-text)]">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-[var(--color-text-2)]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-mono font-medium">{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardCharts() {
  return (
    <>
      {/* 30-day engagement trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-3)]">
            30-day engagement trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={TREND_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <ReTooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs capitalize text-[var(--color-text-3)]">{value}</span>}
              />
              <Line type="monotone" dataKey="instagram" stroke={CHART_COLORS.instagram} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="facebook"  stroke={CHART_COLORS.facebook}  strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="youtube"   stroke={CHART_COLORS.youtube}   strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Platform follower distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-3)]">
            Follower distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center gap-8">
          <PieChart width={180} height={180}>
            <Pie
              data={PLATFORM_DATA}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {PLATFORM_DATA.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <ReTooltip formatter={(value: number) => [`${(value / 1000).toFixed(1)}K`, 'Followers']} />
          </PieChart>
          <div className="space-y-2">
            {PLATFORM_DATA.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
                <span className="text-sm text-[var(--color-text-3)]">{entry.name}</span>
                <span className="font-mono text-sm font-medium text-[var(--color-text)]">
                  {(entry.value / 1000).toFixed(1)}K
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
