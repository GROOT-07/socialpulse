'use client'

import React, { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import {
  Instagram, Facebook, Youtube, CheckCircle2, AlertCircle,
  Trash2, RefreshCw, ExternalLink, Plug, Loader2,
} from 'lucide-react'
import { socialApi } from '@/lib/api'
import type { ConnectedAccount } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'

// ── Platform definitions ──────────────────────────────────────

const PLATFORMS = [
  {
    id: 'INSTAGRAM' as const,
    label: 'Instagram',
    description: 'Business or Creator account — profile metrics, media insights, audience data',
    Icon: Instagram,
    color: 'var(--platform-instagram)',
    connectKey: 'instagram' as const,
    scopes: ['instagram_basic', 'instagram_manage_insights', 'pages_show_list'],
  },
  {
    id: 'FACEBOOK' as const,
    label: 'Facebook',
    description: 'Facebook Page — page insights, post engagement, reach & impressions',
    Icon: Facebook,
    color: 'var(--platform-facebook)',
    connectKey: 'facebook' as const,
    scopes: ['pages_show_list', 'pages_read_engagement', 'read_insights'],
  },
  {
    id: 'YOUTUBE' as const,
    label: 'YouTube',
    description: 'YouTube channel — subscriber count, video stats, watch time analytics',
    Icon: Youtube,
    color: 'var(--platform-youtube)',
    connectKey: 'youtube' as const,
    scopes: ['youtube.readonly', 'yt-analytics.readonly'],
  },
] as const

// ── Connected account card ────────────────────────────────────

interface ConnectedCardProps {
  account: ConnectedAccount
  platform: (typeof PLATFORMS)[number]
  onDisconnect: (id: string) => void
  onSync: (id: string) => void
  isDisconnecting: boolean
  isSyncing: boolean
}

function ConnectedCard({
  account, platform, onDisconnect, onSync, isDisconnecting, isSyncing,
}: ConnectedCardProps) {
  const { Icon, color } = platform
  const tokenExpiry = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null
  const isExpiringSoon = tokenExpiry
    ? tokenExpiry.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
    : false

  return (
    <div className="flex items-center gap-4 rounded-lg border border-brand-border bg-surface p-4">
      {/* Platform icon */}
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}18`, color }}
      >
        <Icon className="h-5 w-5" />
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-[var(--color-text)]">{platform.label}</p>
          <Badge variant="default" className="gap-1 text-[10px] py-0">
            <CheckCircle2 className="h-2.5 w-2.5 text-success" />
            Connected
          </Badge>
          {isExpiringSoon && (
            <Badge variant="default" className="gap-1 text-[10px] py-0 text-warning border-warning/30 bg-warning/10">
              <AlertCircle className="h-2.5 w-2.5" />
              Token expiring soon
            </Badge>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-4)] font-mono mt-0.5">
          ID: {account.handle ?? '—'}
        </p>
        <p className="text-xs text-[var(--color-text-4)] mt-0.5">
          Connected {formatDate(account.connectedAt)}
          {tokenExpiry && ` · token expires ${formatDate(tokenExpiry)}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSync(account.id)}
          disabled={isSyncing}
          className="h-8 w-8 p-0 text-[var(--color-text-4)]"
          title="Sync now"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDisconnect(account.id)}
          disabled={isDisconnecting}
          className="h-8 w-8 p-0 text-danger hover:bg-danger-light hover:text-danger"
          title="Disconnect"
        >
          {isDisconnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Available (not connected) card ────────────────────────────

interface AvailableCardProps {
  platform: (typeof PLATFORMS)[number]
  onConnect: (key: 'instagram' | 'facebook' | 'youtube') => void
  isConnecting: boolean
}

function AvailableCard({ platform, onConnect, isConnecting }: AvailableCardProps) {
  const { Icon, color, label, description, scopes, connectKey } = platform

  return (
    <div className="flex items-center gap-4 rounded-lg border border-brand-border bg-surface-2 p-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg opacity-60"
        style={{ background: `${color}18`, color }}
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-[var(--color-text)]">{label}</p>
        <p className="text-xs text-[var(--color-text-4)] mt-0.5 leading-relaxed">{description}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {scopes.map((s) => (
            <span key={s} className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-4)] border border-brand-border">
              {s}
            </span>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        size="sm"
        onClick={() => onConnect(connectKey)}
        disabled={isConnecting}
        className="shrink-0 gap-1.5"
      >
        {isConnecting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plug className="h-3.5 w-3.5" />
        )}
        Connect
      </Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function ConnectedAccountsPage() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Handle OAuth callback query params
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected) {
      setToast({ type: 'success', message: `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!` })
      queryClient.invalidateQueries({ queryKey: ['social', 'accounts'] })
      // Clean up URL
      window.history.replaceState({}, '', '/settings/accounts')
    } else if (error) {
      setToast({ type: 'error', message: decodeURIComponent(error) })
      window.history.replaceState({}, '', '/settings/accounts')
    }
  }, [searchParams, queryClient])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['social', 'accounts'],
    queryFn: () => socialApi.getAccounts(),
  })

  const accounts = (accountsData as { accounts: ConnectedAccount[] } | undefined)?.accounts ?? []

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => socialApi.disconnect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'accounts'] })
      setToast({ type: 'success', message: 'Account disconnected.' })
    },
    onError: (err) => {
      setToast({ type: 'error', message: (err as Error).message })
    },
  })

  const syncMutation = useMutation({
    mutationFn: (id: string) => socialApi.triggerSync(id),
    onSuccess: () => {
      setToast({ type: 'success', message: 'Sync queued — data will update shortly.' })
    },
    onError: (err) => {
      setToast({ type: 'error', message: (err as Error).message })
    },
  })

  async function handleConnect(platform: 'instagram' | 'facebook' | 'youtube') {
    setConnectingPlatform(platform)
    try {
      const result = await socialApi.getConnectUrl(platform) as { url: string }
      window.location.href = result.url
    } catch (err) {
      setToast({ type: 'error', message: (err as Error).message ?? 'Failed to initiate connection' })
      setConnectingPlatform(null)
    }
  }

  const connectedPlatformIds = new Set(accounts.map((a) => a.platform))
  const connectedPlatforms = PLATFORMS.filter((p) => connectedPlatformIds.has(p.id))
  const availablePlatforms = PLATFORMS.filter((p) => !connectedPlatformIds.has(p.id))

  return (
    <>
      <PageHeader
        title="Connected Accounts"
        description="Manage your social media account connections. Metrics are synced daily."
      />

      {/* ── Toast notification ── */}
      {toast && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      {/* ── Connected accounts ── */}
      {(isLoading || accounts.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Connected accounts</CardTitle>
            <CardDescription className="text-xs">
              Metrics sync daily at 7 AM UTC. Click the refresh icon to trigger a manual sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="skeleton h-[70px] w-full rounded-lg" />
                ))
              : connectedPlatforms.map((platform) => {
                  const account = accounts.find((a) => a.platform === platform.id)!
                  return (
                    <ConnectedCard
                      key={platform.id}
                      account={account}
                      platform={platform}
                      onDisconnect={(id) => disconnectMutation.mutate(id)}
                      onSync={(id) => syncMutation.mutate(id)}
                      isDisconnecting={disconnectMutation.isPending && disconnectMutation.variables === account.id}
                      isSyncing={syncMutation.isPending && syncMutation.variables === account.id}
                    />
                  )
                })}
          </CardContent>
        </Card>
      )}

      {/* ── Available platforms ── */}
      {availablePlatforms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add an account</CardTitle>
            <CardDescription className="text-xs">
              You&apos;ll be redirected to the platform to authorize read-only access.
              No posting permissions are requested.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {availablePlatforms.map((platform) => (
              <AvailableCard
                key={platform.id}
                platform={platform}
                onConnect={handleConnect}
                isConnecting={connectingPlatform === platform.connectKey}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── All connected ── */}
      {!isLoading && availablePlatforms.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
            <p className="font-semibold text-sm text-[var(--color-text)]">All platforms connected</p>
            <p className="mt-1 text-xs text-[var(--color-text-4)]">
              Instagram, Facebook, and YouTube are all syncing.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Data privacy note ── */}
      <Separator className="my-6" />
      <p className="flex items-start gap-2 text-xs text-[var(--color-text-4)]">
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        SocialPulse requests <strong>read-only</strong> permissions. We never post, publish,
        or modify content on your behalf. OAuth tokens are encrypted at rest using AES-256.
      </p>
    </>
  )
}
