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
  const setActiveOrg = useOrgStore((s) => s.setActiveOrg)
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

// ── 