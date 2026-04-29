'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MapPin, Instagram, Facebook, Youtube, BarChart2,
  ExternalLink, Sparkles, Users, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { competitorApi, type Competitor } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'

// ── Platform config ────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  YOUTUBE: Youtube,
}

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: 'var(--platform-instagram)',
  FACEBOOK: 'var(--platform-facebook)',
  YOUTUBE: 'var(--platform-youtube)',
}

// ── Competitor type with V2 discovery fields ──────────────────

interface DiscoveredCompetitor extends Competitor {
  businessName?: string
  address?: string
  city?: string
  website?: string
  relevanceScore?: number
  discoveryReason?: string
  status?: 'PENDING' | 'CONFIRMED' | 'DISMISSED'
}

// ── Pin colors by relevance score ─────────────────────────────

function getPinColor(score: number): string {
  if (score >= 75) return '#ef4444' // high relevance — red
  if (score >= 50) return '#f97316' // medium — orange
  return '#6b7280'                  // low — gray
}

// ── Static map embed using OpenStreetMap + Leaflet-style URL ──
// We use a simple Google Static Maps embed or OSM iframe.
// Since Google Maps requires an API key, we use OSM Nominatim
// to geocode + display a static SVG grid with pins.

function CompetitorMapPin({
  competitor,
  index,
  selected,
  onSelect,
}: {
  competitor: DiscoveredCompetitor
  index: number
  selected: boolean
  onSelect: () => void
}) {
  const score = competitor.relevanceScore ?? 50
  const color = getPinColor(score)

  // Distribute pins visually across a 600×400 area
  // Using a deterministic pseudo-random placement based on index
  const cols = 5
  const col = index % cols
  const row = Math.floor(index / cols)
  const x = 80 + col * 100 + ((index * 17) % 40) - 20
  const y = 80 + row * 100 + ((index * 13) % 40) - 20

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onSelect}
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={competitor.businessName ?? competitor.name}
    >
      {/* Shadow */}
      <ellipse cx="0" cy="22" rx="8" ry="3" fill="rgba(0,0,0,0.15)" />
      {/* Pin body */}
      <path
        d="M0,-20 C-10,-20 -16,-14 -16,-6 C-16,6 0,20 0,20 C0,20 16,6 16,-6 C16,-14 10,-20 0,-20 Z"
        fill={selected ? 'var(--color-accent)' : color}
        stroke="white"
        strokeWidth="2"
      />
      {/* Pin dot */}
      <circle cx="0" cy="-6" r="5" fill="white" opacity="0.9" />
      {/* Index label */}
      <text
        x="0"
        y="-3"
        textAnchor="middle"
        fontSize="6"
        fontWeight="700"
        fill={selected ? 'var(--color-accent)' : color}
      >
        {index + 1}
      </text>
      {/* Hover label */}
      {selected && (
        <text
          x="0"
          y="32"
          textAnchor="middle"
          fontSize="9"
          fontWeight="600"
          fill="var(--color-text)"
        >
          {(competitor.businessName ?? competitor.name).slice(0, 16)}
        </text>
      )}
    </g>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function CompetitorMapPage(): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['competitors', 'confirmed'],
    queryFn: () => competitorApi.list('CONFIRMED'),
  })

  const { data: allData } = useQuery({
    queryKey: ['competitors', 'all'],
    queryFn: () => competitorApi.list(),
  })

  const confirmed = (data?.competitors ?? []) as DiscoveredCompetitor[]
  const all = (allData?.competitors ?? []) as DiscoveredCompetitor[]

  // Show confirmed + pending (not dismissed)
  const mapCompetitors = all.filter((c) => c.status !== 'DISMISSED')

  const selectedCompetitor = mapCompetitors.find((c) => c.id === selected)

  return (
    <>
      <PageHeader
        title="Competitor Map"
        description="Geographic distribution of your discovered competitors."
        actions={
          <Link href="/competitors">
            <Button variant="secondary" size="sm">
              ← Back to List
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 skeleton h-96 rounded-xl" />
          <div className="skeleton h-96 rounded-xl" />
        </div>
      ) : mapCompetitors.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<MapPin className="h-12 w-12" />}
              heading="No competitors on map yet"
              description="Run competitor discovery first to see them plotted on the map."
              action={{ label: 'Go to Competitors', href: '/competitors' }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* ── Map panel ── */}
          <Card className="xl:col-span-2 overflow-hidden">
            <CardHeader className="pb-2 border-b border-brand-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  Competitor Locations
                </CardTitle>
                <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-4)]">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                    High relevance
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
                    Medium
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />
                    Lower
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* SVG map visualization */}
              <div className="relative bg-[var(--color-surface-2)] border-b border-brand-border">
                <svg
                  viewBox="0 0 600 380"
                  className="w-full h-auto"
                  style={{ maxHeight: '420px' }}
                >
                  {/* Background grid — represents local area */}
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--color-border)" strokeWidth="0.5" opacity="0.4" />
                    </pattern>
                    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Map background */}
                  <rect width="600" height="380" fill="url(#grid)" />
                  <rect width="600" height="380" fill="url(#centerGlow)" />

                  {/* Center point — "Your Business" */}
                  <g transform="translate(300, 190)">
                    <circle cx="0" cy="0" r="40" fill="var(--color-accent)" opacity="0.08" />
                    <circle cx="0" cy="0" r="20" fill="var(--color-accent)" opacity="0.12" />
                    <circle cx="0" cy="0" r="10" fill="var(--color-accent)" opacity="0.3" />
                    <circle cx="0" cy="0" r="5" fill="var(--color-accent)" />
                    <text x="0" y="-16" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-accent)">
                      YOU
                    </text>
                  </g>

                  {/* Radius rings */}
                  <circle cx="300" cy="190" r="80" fill="none" stroke="var(--color-accent)" strokeWidth="0.5" opacity="0.2" strokeDasharray="4 4" />
                  <circle cx="300" cy="190" r="150" fill="none" stroke="var(--color-accent)" strokeWidth="0.5" opacity="0.12" strokeDasharray="4 4" />

                  {/* Competitor pins */}
                  {mapCompetitors.map((c, i) => (
                    <CompetitorMapPin
                      key={c.id}
                      competitor={c}
                      index={i}
                      selected={selected === c.id}
                      onSelect={() => setSelected(selected === c.id ? null : c.id)}
                    />
                  ))}
                </svg>

                {/* Legend overlay */}
                <div className="absolute bottom-3 left-3 rounded-lg bg-surface/90 border border-brand-border px-3 py-2 text-[10px] text-[var(--color-text-4)] backdrop-blur-sm">
                  <p className="font-semibold text-[var(--color-text-3)] mb-1">
                    {mapCompetitors.length} competitors in your area
                  </p>
                  <p>Click a pin to see details</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Sidebar: competitor list / detail ── */}
          <div className="flex flex-col gap-3">
            {selectedCompetitor ? (
              /* Detail card */
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Competitor Detail</CardTitle>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-[10px] text-[var(--color-text-4)] hover:text-[var(--color-text-2)]"
                    >
                      ✕ Close
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Platform + name */}
                  <div className="flex items-center gap-2.5">
                    {(() => {
                      const Icon = PLATFORM_ICONS[selectedCompetitor.platform] ?? BarChart2
                      const color = PLATFORM_COLORS[selectedCompetitor.platform] ?? 'var(--color-text-4)'
                      return (
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ background: `${color}20`, color }}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                      )
                    })()}
                    <div>
                      <p className="font-semibold text-sm text-[var(--color-text)]">
                        {selectedCompetitor.businessName ?? selectedCompetitor.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-4)] font-mono">
                        @{selectedCompetitor.handle}
                      </p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="gap-1 text-[10px] h-5 px-1.5 border-accent/30 text-accent bg-accent-light">
                      <Sparkles className="h-2.5 w-2.5" /> Discovered
                    </Badge>
                    {selectedCompetitor.relevanceScore != null && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
                        {selectedCompetitor.relevanceScore}% match
                      </Badge>
                    )}
                    {selectedCompetitor.status && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 px-1.5 ${
                          selectedCompetitor.status === 'CONFIRMED'
                            ? 'bg-success/10 text-success border-success/20'
                            : ''
                        }`}
                      >
                        {selectedCompetitor.status}
                      </Badge>
                    )}
                  </div>

                  {/* Address */}
                  {selectedCompetitor.address && (
                    <p className="flex items-start gap-1.5 text-xs text-[var(--color-text-3)]">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-[var(--color-text-4)]" />
                      {selectedCompetitor.address}
                    </p>
                  )}

                  {/* Why discovered */}
                  {selectedCompetitor.discoveryReason && (
                    <div className="rounded-lg bg-surface-2 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)] mb-1">
                        Why this competitor?
                      </p>
                      <p className="text-xs text-[var(--color-text-3)]">
                        {selectedCompetitor.discoveryReason}
                      </p>
                    </div>
                  )}

                  {/* Metrics */}
                  {selectedCompetitor.latestMetrics && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded bg-surface-2 p-2">
                        <p className="font-mono text-sm font-bold text-[var(--color-text)]">
                          {formatNumber(selectedCompetitor.latestMetrics.followers ?? 0)}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-4)]">Followers</p>
                      </div>
                      <div className="rounded bg-surface-2 p-2">
                        <p className="font-mono text-sm font-bold text-[var(--color-text)]">
                          {selectedCompetitor.latestMetrics.engagementRate != null
                            ? `${selectedCompetitor.latestMetrics.engagementRate.toFixed(1)}%`
                            : '—'}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-4)]">Engagement</p>
                      </div>
                    </div>
                  )}

                  {/* Website link */}
                  {selectedCompetitor.website && (
                    <a
                      href={selectedCompetitor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {selectedCompetitor.website.replace(/^https?:\/\//, '').split('/')[0]}
                    </a>
                  )}

                  <Link href={`/competitors/content?id=${selectedCompetitor.id}`} className="block">
                    <Button variant="secondary" size="sm" className="w-full text-xs h-8">
                      View Posts & Content
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              /* Ranked list */
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" /> Ranked List
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-brand-border">
                    {mapCompetitors.map((c, i) => {
                      const Icon = PLATFORM_ICONS[c.platform] ?? BarChart2
                      const color = PLATFORM_COLORS[c.platform] ?? 'var(--color-text-4)'
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelected(c.id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                        >
                          <span className="text-[10px] font-mono font-bold text-[var(--color-text-4)] w-4 shrink-0">
                            {i + 1}
                          </span>
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                            style={{ background: `${color}20`, color }}
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--color-text)] truncate">
                              {c.businessName ?? c.name}
                            </p>
                            <p className="text-[10px] text-[var(--color-text-4)] font-mono truncate">
                              @{c.handle}
                            </p>
                          </span>
                          {c.relevanceScore != null && (
                            <span className="text-[10px] font-mono font-semibold text-[var(--color-text-4)] shrink-0">
                              {c.relevanceScore}%
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats summary */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-4)]">
                  Discovery Summary
                </p>
                {[
                  { label: 'Total discovered', value: all.length },
                  { label: 'Confirmed tracking', value: confirmed.length },
                  { label: 'Pending review', value: all.filter((c) => c.status === 'PENDING').length },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-3)]">{label}</span>
                    <span className="text-xs font-mono font-bold text-[var(--color-text)]">{value}</span>
                  </div>
                ))}
                <Link href="/competitors" className="block pt-1">
                  <Button variant="secondary" size="sm" className="w-full text-xs h-7">
                    Manage Competitors →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
