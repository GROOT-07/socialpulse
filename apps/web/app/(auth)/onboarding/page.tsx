'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, ChevronRight, Instagram, Youtube, Plus, Trash2,
  Building2, Palette, Users, Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { orgsApi, socialApi, competitorApi } from '@/lib/api'
import { useOrgStore } from '@/store/org.store'
import { toast } from 'sonner'

const STEPS = [
  { id: 1, label: 'Your organization', icon: Building2 },
  { id: 2, label: 'Connect accounts',  icon: Share2 },
  { id: 3, label: 'Add competitors',   icon: Users },
  { id: 4, label: 'Pick platforms',    icon: Palette },
]

const PLATFORMS = [
  { key: 'INSTAGRAM', label: 'Instagram', color: '#E1306C' },
  { key: 'FACEBOOK',  label: 'Facebook',  color: '#1877F2' },
  { key: 'YOUTUBE',   label: 'YouTube',   color: '#FF0000' },
]

// ── Step 1 — Org details ──────────────────────────────────────

function StepOrgDetails({ onNext }: { onNext: () => void }) {
  const activeOrg = useOrgStore((s) => s.activeOrg)
  const [brandColor, setBrandColor] = useState(activeOrg?.brandColor ?? '#4F6EF7')
  const [industry, setIndustry] = useState(activeOrg?.industry ?? '')

  const mutation = useMutation({
    mutationFn: () => orgsApi.update(activeOrg!.id, { brandColor, industry }),
    onSuccess: () => onNext(),
    onError: () => onNext(),
  })

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-surface-2 px-4 py-3 flex items-center gap-3">
        <Building2 className="h-5 w-5 text-accent shrink-0" />
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{activeOrg?.name}</p>
          <p className="text-xs text-[var(--color-text-4)]">Your organization is ready</p>
        </div>
        <Badge variant="accent" className="ml-auto">Active</Badge>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="industry">Industry</Label>
        <Input
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="e.g. Education, E-commerce, SaaS…"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Brand colour</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded border border-brand-border bg-transparent p-1"
          />
          <span className="text-sm font-mono text-[var(--color-text-3)]">{brandColor}</span>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={() => mutation.mutate()}
        loading={mutation.isPending}
      >
        Save & continue <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ── Step 2 — Connect social accounts ─────────────────────────

function StepConnectAccounts({ onNext }: { onNext: () => void }) {
  const { data } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => socialApi.getAccounts(),
  })
  const accounts = data?.accounts ?? []

  const connect = async (platform: 'instagram' | 'facebook' | 'youtube') => {
    try {
      const res = await socialApi.getConnectUrl(platform)
      if (res?.data?.url) window.location.href = res.data.url
    } catch {
      toast.error('Could not start OAuth — check your API credentials')
    }
  }

  const isConnected = (p: string) => accounts.some((a) => a.platform === p.toUpperCase())

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-3)]">
        Connect your social accounts so SocialPulse can pull metrics automatically.
        You can always add more later in Settings.
      </p>

      {[
        { id: 'instagram', label: 'Instagram', color: '#E1306C' },
        { id: 'facebook',  label: 'Facebook',  color: '#1877F2' },
        { id: 'youtube',   label: 'YouTube',   color: '#FF0000' },
      ].map((p) => {
        const connected = isConnected(p.id)
        return (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-brand-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: p.color + '20' }}>
                {p.id === 'youtube'
                  ? <Youtube className="h-4 w-4" style={{ color: p.color }} />
                  : <Instagram className="h-4 w-4" style={{ color: p.color }} />}
              </div>
              <span className="text-sm font-medium">{p.label}</span>
            </div>
            {connected
              ? <Badge variant="success">Connected</Badge>
              : (
                <Button size="sm" variant="secondary" onClick={() => connect(p.id as 'instagram' | 'facebook' | 'youtube')}>
                  Connect
                </Button>
              )}
          </div>
        )
      })}

      <Button className="w-full mt-2" onClick={onNext}>
        {accounts.length > 0 ? 'Continue' : 'Skip for now'} <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ── Step 3 — Add competitors ──────────────────────────────────

function StepCompetitors({ onNext }: { onNext: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', platform: 'INSTAGRAM', handle: '' })
  const [added, setAdded] = useState<string[]>([])

  const mutation = useMutation({
    mutationFn: () => competitorApi.add({
      name: form.name,
      platform: form.platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE',
      handle: form.handle,
    }),
    onSuccess: () => {
      setAdded((p) => [...p, `${form.name} (${form.platform})`])
      setForm({ name: '', platform: 'INSTAGRAM', handle: '' })
      qc.invalidateQueries({ queryKey: ['competitors'] })
      toast.success('Competitor added')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-3)]">
        Track what your competitors are doing. Add at least one to unlock gap analysis.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Competitor name</Label>
          <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Corp" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <select
              value={form.platform}
              onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value }))}
              className="h-9 w-full rounded border border-brand-border-2 bg-surface px-3 text-sm text-[var(--color-text)]"
            >
              {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Handle</Label>
            <Input value={form.handle} onChange={(e) => setForm((p) => ({ ...p, handle: e.target.value }))} placeholder="@handle" />
          </div>
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => mutation.mutate()}
          disabled={!form.name || !form.handle || mutation.isPending}
          loading={mutation.isPending}
        >
          <Plus className="h-4 w-4" /> Add competitor
        </Button>
      </div>

      {added.length > 0 && (
        <div className="space-y-1.5">
          {added.map((a) => (
            <div key={a} className="flex items-center gap-2 rounded bg-surface-2 px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-[var(--color-text-3)]">{a}</span>
            </div>
          ))}
        </div>
      )}

      <Button className="w-full" onClick={onNext}>
        {added.length > 0 ? 'Continue' : 'Skip for now'} <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ── Step 4 — Choose platforms ─────────────────────────────────

function StepChoosePlatforms({ onFinish }: { onFinish: () => void }) {
  const activeOrg = useOrgStore((s) => s.activeOrg)
  const [selected, setSelected] = useState<string[]>(activeOrg?.activePlatforms ?? ['INSTAGRAM'])

  const toggle = (key: string) =>
    setSelected((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key])

  const mutation = useMutation({
    mutationFn: () => orgsApi.update(activeOrg!.id, { activePlatforms: selected }),
    onSuccess: () => onFinish(),
    onError: () => onFinish(),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-3)]">
        Which platforms does your brand focus on? This customises your dashboard and reports.
      </p>

      <div className="space-y-2">
        {PLATFORMS.map((p) => {
          const active = selected.includes(p.key)
          return (
            <button
              key={p.key}
              onClick={() => toggle(p.key)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                active
                  ? 'border-accent bg-accent/5'
                  : 'border-brand-border hover:bg-surface-2',
              )}
            >
              <div className="h-3 w-3 rounded-full" style={{ background: p.color }} />
              <span className="text-sm font-medium flex-1">{p.label}</span>
              {active && <CheckCircle2 className="h-4 w-4 text-accent" />}
            </button>
          )
        })}
      </div>

      <Button
        className="w-full"
        onClick={() => mutation.mutate()}
        disabled={selected.length === 0 || mutation.isPending}
        loading={mutation.isPending}
      >
        Finish setup <CheckCircle2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function OnboardingPage(): React.JSX.Element {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const next = () => setStep((s) => Math.min(STEPS.length, s + 1))
  const finish = () => router.replace('/')

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress steps */}
      <div className="mb-8 flex items-center justify-between">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-200',
                step > s.id
                  ? 'border-success bg-success text-white'
                  : step === s.id
                  ? 'border-accent bg-accent text-white'
                  : 'border-brand-border-2 bg-surface text-[var(--color-text-4)]',
              )}>
                {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className={cn(
                'hidden sm:block text-xs font-medium',
                step === s.id ? 'text-accent' : 'text-[var(--color-text-4)]',
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'h-px flex-1 mx-2 transition-colors duration-200',
                step > s.id ? 'bg-success' : 'bg-brand-border',
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardContent className="py-8 px-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              {STEPS[step - 1]?.label}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-4)]">
              Step {step} of {STEPS.length}
            </p>
          </div>

          {step === 1 && <StepOrgDetails onNext={next} />}
          {step === 2 && <StepConnectAccounts onNext={next} />}
          {step === 3 && <StepCompetitors onNext={next} />}
          {step === 4 && <StepChoosePlatforms onFinish={finish} />}
        </CardContent>
      </Card>
    </div>
  )
}
