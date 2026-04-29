'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Trash2, ShieldCheck, Eye, Users, Mail, ChevronDown } from 'lucide-react'
import { settingsApi, type TeamMember } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'

const ROLE_CONFIG = {
  ORG_ADMIN: { label: 'Admin', icon: ShieldCheck, color: 'bg-accent-light text-accent border-accent/20' },
  VIEWER: { label: 'Viewer', icon: Eye, color: 'bg-surface-2 text-[var(--color-text-3)] border-brand-border' },
  SUPER_ADMIN: { label: 'Super Admin', icon: ShieldCheck, color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400' },
} as const

function getInitials(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

export default function TeamPage() {
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ORG_ADMIN' | 'VIEWER'>('VIEWER')

  const { data, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => settingsApi.listTeam(),
  })

  const inviteMutation = useMutation({
    mutationFn: () => settingsApi.inviteMember(inviteEmail.trim(), inviteRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] })
      toast.success(`${inviteEmail.trim()} added to your team`)
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('VIEWER')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      settingsApi.updateRole(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] })
      toast.success('Role updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => settingsApi.removeMember(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] })
      toast.success('Member removed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const members: TeamMember[] = data?.members ?? []

  return (
    <>
      <PageHeader
        title="Team Members"
        description="Manage who has access to this organization."
        icon={<Users className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Invite Member
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Members</CardTitle>
            <Badge variant="outline" className="text-xs">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-40 rounded" />
                    <div className="skeleton h-3 w-24 rounded" />
                  </div>
                  <div className="skeleton h-7 w-24 rounded" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              heading="No team members yet"
              description="Invite colleagues to collaborate on this organization's social media strategy."
              action={{ label: 'Invite First Member', onClick: () => setInviteOpen(true) }}
            />
          ) : (
            <div className="divide-y divide-brand-border">
              {members.map((m) => {
                const roleKey = m.role as keyof typeof ROLE_CONFIG
                const cfg = ROLE_CONFIG[roleKey] ?? ROLE_CONFIG.VIEWER
                const RoleIcon = cfg.icon

                return (
                  <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-accent text-white">
                        {getInitials(m.user.email)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{m.user.email}</p>
                      <p className="text-xs text-[var(--color-text-4)]">
                        Joined {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={`flex items-center gap-1 text-xs ${cfg.color}`}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>

                      {/* Role change dropdown — only for non-super-admins */}
                      {m.role !== 'SUPER_ADMIN' && (
                        <Select
                          value={m.role}
                          onValueChange={(role) => updateRoleMutation.mutate({ userId: m.userId, role })}
                        >
                          <SelectTrigger className="h-7 w-8 px-1.5 border-dashed">
                            <ChevronDown className="h-3 w-3" />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value="ORG_ADMIN">
                              <span className="flex items-center gap-1.5">
                                <ShieldCheck className="h-3 w-3" />Admin
                              </span>
                            </SelectItem>
                            <SelectItem value="VIEWER">
                              <span className="flex items-center gap-1.5">
                                <Eye className="h-3 w-3" />Viewer
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--color-text-4)] hover:text-danger"
                        onClick={() => {
                          if (confirm(`Remove ${m.user.email} from this organization?`)) {
                            removeMutation.mutate(m.userId)
                          }
                        }}
                        disabled={removeMutation.isPending}
                        title="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role info card */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-border p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-[var(--color-text)]">Admin</span>
              </div>
              <ul className="space-y-1 text-xs text-[var(--color-text-3)]">
                <li>• View and edit all analytics data</li>
                <li>• Manage content calendar and ideas</li>
                <li>• Edit strategy, goals, and playbook</li>
                <li>• Manage checklist and audit items</li>
                <li>• Invite and remove team members</li>
              </ul>
            </div>
            <div className="rounded-lg border border-brand-border p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4 text-[var(--color-text-3)]" />
                <span className="text-sm font-medium text-[var(--color-text)]">Viewer</span>
              </div>
              <ul className="space-y-1 text-xs text-[var(--color-text-3)]">
                <li>• View all analytics data and reports</li>
                <li>• Browse content calendar and ideas</li>
                <li>• Read strategy and playbook</li>
                <li>• Cannot edit or delete anything</li>
                <li>• Cannot manage team members</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invite Team Member
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inviteEmail.trim()) inviteMutation.mutate()
                }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'ORG_ADMIN' | 'VIEWER')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORG_ADMIN">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />Admin — can edit everything
                    </span>
                  </SelectItem>
                  <SelectItem value="VIEWER">
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />Viewer — read-only access
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-[var(--color-text-4)]">
              If this email isn&apos;t registered yet, an account will be created and they can set their
              password via the Forgot Password flow.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              {inviteMutation.isPending ? 'Inviting…' : 'Add to Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
