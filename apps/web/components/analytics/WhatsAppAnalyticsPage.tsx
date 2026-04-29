'use client'

import React from 'react'
import { MessageCircle, Users, TrendingUp, Phone, CheckCheck, Clock, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { request } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────

interface WAMetrics {
  phoneNumber: string | null
  businessName: string | null
  profilePicUrl: string | null
  totalContacts: number
  messagesSent: number
  messagesDelivered: number
  messagesRead: number
  responseRate: number
  avgResponseTime: number // minutes
  broadcastsSent: number
  catalogItems: number
}

// ── Page ──────────────────────────────────────────────────────

export function WhatsAppAnalyticsPage(): React.JSX.Element {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['whatsapp-metrics'],
    queryFn: () => request<{ metrics: WAMetrics | null }>('/api/metrics/whatsapp'),
    retry: false,
  })

  const metrics = data?.metrics ?? null
  const isNotConnected = isError || metrics === null

  return (
    <>
      <PageHeader
        title="WhatsApp Business Analytics"
        description="Track your WhatsApp Business account reach, message performance, and response rates."
        actions={
          metrics && (
            <Badge
              className="gap-1.5 bg-[#25d36620] text-[#25d366] border-[#25d36640]"
            >
              <MessageCircle className="h-3 w-3" />
              Connected
            </Badge>
          )
        }
      />

      {isNotConnected ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<MessageCircle className="h-12 w-12" style={{ color: '#25d366' }} />}
                heading="WhatsApp Business not connected"
                description="Connect your WhatsApp Business account to track message analytics, broadcast performance, and audience engagement."
                action={{ label: 'Connect in Settings', href: '/settings/accounts' }}
              />
            </CardContent>
          </Card>

          {/* WhatsApp Business info cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: Users,
                title: 'Audience Reach',
                desc: 'See how many contacts your business page has and message delivery rates.',
              },
              {
                icon: TrendingUp,
                title: 'Broadcast Analytics',
                desc: 'Track open rates and click-throughs for your WhatsApp broadcast messages.',
              },
              {
                icon: Clock,
                title: 'Response Time',
                desc: 'Monitor your average response time to customer messages and improve satisfaction.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="bg-surface-2">
                <CardContent className="p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg mb-3"
                    style={{ background: '#25d36620', color: '#25d366' }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-[var(--color-text)] mb-1">{title}</p>
                  <p className="text-xs text-[var(--color-text-4)]">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/settings/accounts">
              <Button style={{ background: '#25d366' }} className="text-white hover:opacity-90">
                <MessageCircle className="mr-2 h-4 w-4" />
                Connect WhatsApp Business
              </Button>
            </Link>
            <a
              href="https://business.whatsapp.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm" className="gap-1.5">
                Learn more <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Account header */}
          <div className="mb-6 flex items-center gap-3">
            {metrics.profilePicUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={metrics.profilePicUrl}
                alt={metrics.businessName ?? 'WhatsApp'}
                className="h-10 w-10 rounded-full ring-2 ring-brand-border"
              />
            )}
            <div>
              <p className="font-semibold text-[var(--color-text)]">
                {metrics.businessName ?? 'WhatsApp Business'}
              </p>
              <p className="text-xs text-[var(--color-text-4)]">
                {metrics.phoneNumber ?? 'Connected'}
              </p>
            </div>
            <span
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: '#25d36620', color: '#25d366' }}
            >
              <MessageCircle className="h-4 w-4" />
            </span>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Total Contacts"
              value={metrics.totalContacts}
              format="number"
              icon={<Users className="h-4 w-4" />}
              loading={isLoading}
            />
            <KpiCard
              label="Messages Sent"
              value={metrics.messagesSent}
              format="number"
              icon={<MessageCircle className="h-4 w-4" />}
              loading={isLoading}
            />
            <KpiCard
              label="Delivery Rate"
              value={metrics.messagesSent > 0 ? (metrics.messagesDelivered / metrics.messagesSent) * 100 : 0}
              format="percent"
              icon={<CheckCheck className="h-4 w-4" />}
              loading={isLoading}
            />
            <KpiCard
              label="Read Rate"
              value={metrics.messagesSent > 0 ? (metrics.messagesRead / metrics.messagesSent) * 100 : 0}
              format="percent"
              icon={<TrendingUp className="h-4 w-4" />}
              loading={isLoading}
            />
            <KpiCard
              label="Response Rate"
              value={metrics.responseRate}
              format="percent"
              icon={<Phone className="h-4 w-4" />}
              loading={isLoading}
            />
            <KpiCard
              label="Avg Response Time"
              value={metrics.avgResponseTime}
              format="number"
              icon={<Clock className="h-4 w-4" />}
              loading={isLoading}
            />
          </div>

          {/* Broadcast + Catalog cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Broadcasts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono text-[var(--color-text)]">
                  {metrics.broadcastsSent}
                </p>
                <p className="text-xs text-[var(--color-text-4)] mt-1">broadcasts sent this period</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Catalog Items</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono text-[var(--color-text)]">
                  {metrics.catalogItems}
                </p>
                <p className="text-xs text-[var(--color-text-4)] mt-1">products / services listed</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
