'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Save, BookOpen, Target, Users, Mic, Layers, FileText, Radio } from 'lucide-react'
import Link from 'next/link'
import { strategyApi, aiApi, type PlaybookSection } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const SECTION_CONFIG: Record<string, { title: string; icon: React.ElementType; description: string }> = {
  BRAND_VOICE:   { title: 'Brand Voice',      icon: Mic,      description: 'How your brand sounds and communicates' },
  STRATEGY:      { title: 'Content Strategy', icon: FileText, description: 'How you plan to create and distribute content' },
  POSTING_GUIDE: { title: 'Posting Guide',    icon: BookOpen, description: 'Cadence, formats, and platform-specific rules' },
  OUTREACH:      { title: 'Outreach Playbook',icon: Radio,    description: 'How you engage with your audience and grow reach' },
}

function PlaybookSectionCard({ section }: { section: PlaybookSection }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(section.content ?? '')
  const config = SECTION_CONFIG[section.sectionType] ?? { title: section.sectionType, icon: FileText, description: '' }
  const Icon = config.icon

  const saveMutation = useMutation({
    mutationFn: () => strategyApi.updateSection(section.sectionType, content),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['playbook'] }); setEditing(false); toast.success('Saved') },
    onError: (e: Error) => toast.error(e.message),
  })

  const aiMutation = useMutation({
    mutationFn: () => aiApi.generatePlaybookSection(section.sectionType),
    onSuccess: ({ section: s }) => { setContent(s.content); setEditing(true); toast.success('Generated — review and save') },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-light text-accent">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-sm">{config.title}</CardTitle>
              <p className="text-xs text-[var(--color-text-4)]">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {section.generatedAt && (
              <Badge variant="outline" className="text-[10px] hidden sm:flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />AI
              </Badge>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending}>
              <Sparkles className="mr-1 h-3 w-3" />{aiMutation.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-2">
            <Textarea value={content} onChange={e => setContent(e.target.value)} className="min-h-[120px] text-sm resize-y" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setContent(section.content ?? '') }}>Cancel</Button>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="mr-1.5 h-3.5 w-3.5" />{saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : content ? (
          <div className="group relative cursor-pointer rounded-lg p-3 hover:bg-surface-2 transition-colors" onClick={() => setEditing(true)}>
            <p className="text-sm leading-relaxed text-[var(--color-text-2)] whitespace-pre-wrap">{content}</p>
            <span className="absolute right-2 top-2 hidden text-xs text-[var(--color-text-4)] group-hover:block">Click to edit</span>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full rounded-lg border border-dashed border-brand-border p-6 text-center text-xs text-[var(--color-text-4)] hover:border-brand-border-2 hover:text-[var(--color-text-3)] transition-colors"
          >
            Click to write, or use Generate to create with AI
          </button>
        )}
      </CardContent>
    </Card>
  )
}

export default function PlaybookPage() {
  const { data, isLoading } = useQuery({ queryKey: ['playbook'], queryFn: () => strategyApi.getPlaybook() })

  const stats = [
    { label: 'Goals', value: data?.goals.length ?? 0, href: '/strategy/goals', icon: Target },
    { label: 'Personas', value: data?.personas.length ?? 0, href: '/strategy/personas', icon: Users },
    { label: 'Pillars', value: data?.pillars.length ?? 0, href: '/strategy/pillars', icon: Layers },
    { label: 'Voice Set', value: data?.voice ? 'Yes' : 'No', href: '/strategy/voice', icon: Mic },
  ]

  const sectionTypes = Object.keys(SECTION_CONFIG)
  const sections = data?.sections ?? []
  const filledSections = sectionTypes.map(type => {
    const existing = sections.find(s => s.sectionType === type)
    return existing ?? { id: type, sectionType: type, content: null, generatedAt: null, updatedAt: new Date().toISOString() }
  })

  return (
    <>
      <PageHeader title="Strategy Playbook" description="Your complete social media strategy document." />

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href}>
            <Card className="hover:border-brand-border-2 transition-colors">
              <CardContent className="p-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-light text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-bold text-sm text-[var(--color-text)]">{value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-4)]">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-6"><div className="skeleton h-24 w-full rounded" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="space-y-4">
          {filledSections.map(s => <PlaybookSectionCard key={s.sectionType} section={s as PlaybookSection} />)}
        </div>
      )}
    </>
  )
}
