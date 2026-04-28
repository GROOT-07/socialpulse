'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Building2, Users, Activity, AlertTriangle } from 'lucide-react'
import { request } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/utils'

interface AdminOrg { id: string; name: string; slug: string; plan: string; industry: string | null; createdAt: string; _count: { members: number } }
interface AdminUser { id: string; email: string; name: string | null; role: string; createdAt: string }
interface QueueInfo { name: string; waiting: number; active: number; completed: number; failed: number }

export default function AdminPage() {
  const { data: orgsData } = useQuery({ queryKey: ['admin-orgs'], queryFn: () => request<{ orgs: AdminOrg[] }>('/api/admin/orgs') })
  const { data: usersData } = useQuery({ queryKey: ['admin-users'], queryFn: () => request<{ users: AdminUser[] }>('/api/admin/users') })
  const { data: queuesData } = useQuery({ queryKey: ['admin-queues'], queryFn: () => request<{ queues: QueueInfo[] }>('/api/admin/queues'), refetchInterval: 10000 })

  const orgs = orgsData?.orgs ?? []
  const users = usersData?.users ?? []
  const queues = queuesData?.queues ?? []

  return (
    <>
      <PageHeader title="Admin Panel" description="Super admin dashboard — platform-wide metrics."
        actions={<Badge variant="outline" className="flex items-center gap-1 text-xs"><Shield className="h-3 w-3" />Super Admin</Badge>}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        {[
          { label: 'Organizations', value: orgs.length, icon: Building2 },
          { label: 'Users', value: users.length, icon: Users },
          { label: 'Active Jobs', value: queues.reduce((s: number, q: QueueInfo) => s + q.active, 0), icon: Activity },
          { label: 'Failed Jobs', value: queues.reduce((s: number, q: QueueInfo) => s + q.failed, 0), icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-light text-accent"><Icon className="h-4 w-4" /></span>
              <div>
                <p className="font-bold text-lg font-mono text-[var(--color-text)]">{formatNumber(value)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Job Queues */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Job Queues</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queues.length === 0 ? (
                <p className="text-sm text-[var(--color-text-4)] py-2">No queue data</p>
              ) : queues.map((q: QueueInfo) => (
                <div key={q.name} className="flex items-center justify-between rounded-lg p-2.5 hover:bg-surface-2">
                  <p className="text-xs font-mono font-medium text-[var(--color-text)]">{q.name}</p>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">{q.waiting} waiting</Badge>
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-accent-light text-accent border-accent/20">{q.active} active</Badge>
                    {q.failed > 0 && <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-danger/10 text-danger border-danger/20">{q.failed} failed</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Orgs */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Organizations</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {orgs.slice(0, 10).map((org: AdminOrg) => (
                <div key={org.id} className="flex items-center justify-between rounded-lg p-2 hover:bg-surface-2">
                  <div>
                    <p className="text-xs font-medium text-[var(--color-text)]">{org.name}</p>
                    <p className="text-[10px] text-[var(--color-text-4)]">{org.slug} · {org.industry ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] h-4 px-1">{org._count.members} members</Badge>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">{org.plan}</Badge>
                  </div>
                </div>
              ))}
              {orgs.length > 10 && <p className="text-xs text-[var(--color-text-4)] pt-1 text-center">+{orgs.length - 10} more</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
