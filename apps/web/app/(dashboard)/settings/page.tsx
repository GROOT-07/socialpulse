'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, UserCog, Trash2 } from 'lucide-react'
import { settingsApi, type TeamMember } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
]

export default function SettingsPage() {
  const qc = useQueryClient()

  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => settingsApi.getOrg(),
  })
  const { data: teamData } = useQuery({
    queryKey: ['team'],
    queryFn: () => settingsApi.listTeam(),
  })

  const [form, setForm] = useState({ name: '', industry: '', city: '', country: '', timezone: 'UTC' })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (orgData?.org) {
      setForm({
        name: orgData.org.name,
        industry: orgData.org.industry ?? '',
        city: orgData.org.city ?? '',
        country: orgData.org.country ?? '',
        timezone: orgData.org.timezone ?? 'UTC',
      })
    }
  }, [orgData])

  const saveOrgMutation = useMutation({
    mutationFn: () => settingsApi.updateOrg({
      name: form.name,
      industry: form.industry || undefined,
      city: form.city || undefined,
      country: form.country || undefined,
      timezone: form.timezone,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-settings'] })
      setDirty(false)
      toast.success('Settings saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => settingsApi.updateRole(userId, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast.success('Role updated') },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => settingsApi.removeMember(userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast.success('Member removed') },
    onError: (e: Error) => toast.error(e.message),
  })

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    setDirty(true)
  }

  const members: TeamMember[] = teamData?.members ?? []

  return (
    <>
      <PageHeader title="Settings" description="Manage your organization settings and team." />

      <div className="space-y-6">
        {/* Org settings */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Organization</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Organization Name</Label>
                <Input value={form.name} onChange={field('name')} disabled={orgLoading} />
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input value={form.industry} onChange={field('industry')} placeholder="e.g. E-commerce, SaaS, Health" disabled={orgLoading} />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={field('city')} placeholder="New York" disabled={orgLoading} />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={form.country} onChange={field('country')} placeholder="US" disabled={orgLoading} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Timezone</Label>
                <Select value={form.timezone} onValueChange={v => { setForm(p => ({ ...p, timezone: v })); setDirty(true) }}>
                  <SelectTrigger disabled={orgLoading}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {dirty && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => saveOrgMutation.mutate()} disabled={!form.name || saveOrgMutation.isPending}>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {saveOrgMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCog className="h-4 w-4" />Team Members
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-surface-2 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white text-xs font-semibold">
                    {m.user.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{m.user.email}</p>
                    <p className="text-xs text-[var(--color-text-4)]">Joined {new Date(m.joinedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={role => updateRoleMutation.mutate({ userId: m.userId, role })}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ORG_ADMIN">Admin</SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-danger hover:text-danger"
                      onClick={() => removeMemberMutation.mutate(m.userId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <p className="py-4 text-center text-sm text-[var(--color-text-4)]">No team members yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connected Accounts shortcut */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Connected Accounts</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-3)] mb-3">
              Manage your Instagram, Facebook, and YouTube connections.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/settings/accounts">Manage Connections</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
