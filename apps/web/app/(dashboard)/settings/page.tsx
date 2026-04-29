'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Settings, Building2, Palette, Globe, Link2, Users } from 'lucide-react'
import Link from 'next/link'
import { settingsApi } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
]

const INDUSTRIES = [
  'Advertising & Marketing',
  'Agriculture',
  'Architecture & Design',
  'Automotive',
  'Beauty & Personal Care',
  'Business Services',
  'Construction',
  'Consulting',
  'E-commerce & Retail',
  'Education',
  'Entertainment & Media',
  'Fashion & Apparel',
  'Finance & Banking',
  'Fitness & Wellness',
  'Food & Beverage',
  'Healthcare & Medical',
  'Hospitality & Tourism',
  'Insurance',
  'Legal Services',
  'Logistics & Transportation',
  'Manufacturing',
  'Non-profit & NGO',
  'Photography & Videography',
  'Real Estate',
  'Restaurant & Cafe',
  'Software & Technology',
  'Sports',
  'Other',
]

export default function SettingsPage() {
  const qc = useQueryClient()

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => settingsApi.getOrg(),
  })

  const [form, setForm] = useState({
    name: '',
    industry: '',
    city: '',
    country: '',
    timezone: 'UTC',
    brandColor: '#5B7FFF',
  })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (orgData?.org) {
      setForm({
        name: orgData.org.name ?? '',
        industry: orgData.org.industry ?? '',
        city: orgData.org.city ?? '',
        country: orgData.org.country ?? '',
        timezone: orgData.org.timezone ?? 'UTC',
        brandColor: orgData.org.brandColor ?? '#5B7FFF',
      })
    }
  }, [orgData])

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateOrg({
        name: form.name || undefined,
        industry: form.industry || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        timezone: form.timezone,
        brandColor: form.brandColor,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-settings'] })
      qc.invalidateQueries({ queryKey: ['active-org'] })
      setDirty(false)
      toast.success('Organization settings saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const field =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((p) => ({ ...p, [k]: e.target.value }))
      setDirty(true)
    }

  const org = orgData?.org

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your organization profile and preferences."
        icon={<Settings className="h-5 w-5" />}
        actions={
          dirty ? (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {/* ── Organization Details ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-[var(--color-text-3)]" />
              Organization Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Organization Name <span className="text-danger">*</span></Label>
                <Input
                  value={form.name}
                  onChange={field('name')}
                  placeholder="Acme Corp"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select
                  value={form.industry}
                  onValueChange={(v) => {
                    setForm((p) => ({ ...p, industry: v }))
                    setDirty(true)
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry…" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select
                  value={form.timezone}
                  onValueChange={(v) => {
                    setForm((p) => ({ ...p, timezone: v }))
                    setDirty(true)
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Location ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-[var(--color-text-3)]" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={field('city')}
                  placeholder="New York"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Country code</Label>
                <Input
                  value={form.country}
                  onChange={field('country')}
                  placeholder="US"
                  maxLength={2}
                  className="uppercase"
                  disabled={isLoading}
                />
                <p className="text-xs text-[var(--color-text-4)]">ISO 2-letter code, e.g. US, IN, GB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Branding ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Palette className="h-4 w-4 text-[var(--color-text-3)]" />
              Brand Color
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={form.brandColor}
                onChange={(e) => {
                  setForm((p) => ({ ...p, brandColor: e.target.value }))
                  setDirty(true)
                }}
                className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface p-0.5"
                disabled={isLoading}
              />
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">{form.brandColor.toUpperCase()}</p>
                <p className="text-xs text-[var(--color-text-4)]">
                  Used as the accent color throughout your organization&apos;s dashboard.
                </p>
              </div>
              <div
                className="ml-auto h-8 w-20 rounded-lg"
                style={{ background: form.brandColor }}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Org info badges ── */}
        {org && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Organization Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs gap-1">
                  <span className="text-[var(--color-text-4)]">ID:</span>
                  <span className="font-mono">{org.id.slice(0, 8)}…</span>
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <span className="text-[var(--color-text-4)]">Slug:</span>
                  {org.slug}
                </Badge>
                {org.activePlatforms.length > 0 && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <span className="text-[var(--color-text-4)]">Platforms:</span>
                    {org.activePlatforms.join(', ')}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Quick links to other settings ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="hover:border-accent/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light text-accent">
                <Link2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">Connected Accounts</p>
                <p className="text-xs text-[var(--color-text-4)]">Instagram, Facebook, YouTube OAuth</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings/accounts">Manage</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-accent/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light text-accent">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">Team Members</p>
                <p className="text-xs text-[var(--color-text-4)]">Invite colleagues and manage roles</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings/team">Manage</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Save footer for mobile ── */}
        {dirty && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
