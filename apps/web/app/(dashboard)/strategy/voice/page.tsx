'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Save, Mic } from 'lucide-react'
import { strategyApi, aiApi } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function BrandVoicePage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['brand-voice'], queryFn: () => strategyApi.getVoice() })

  const [form, setForm] = useState({ tone: '', vocabulary: '', doList: '', dontList: '', examplePost: '' })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data?.voice) {
      setForm({
        tone: data.voice.tone ?? '',
        vocabulary: data.voice.vocabulary ?? '',
        doList: data.voice.doList ?? '',
        dontList: data.voice.dontList ?? '',
        examplePost: data.voice.examplePost ?? '',
      })
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => strategyApi.upsertVoice({
      tone: form.tone || null,
      vocabulary: form.vocabulary || null,
      doList: form.doList || null,
      dontList: form.dontList || null,
      examplePost: form.examplePost || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brand-voice'] }); setDirty(false); toast.success('Brand voice saved') },
    onError: (e: Error) => toast.error(e.message),
  })

  const aiMutation = useMutation({
    mutationFn: () => aiApi.generateBrandVoice(),
    onSuccess: ({ voice }) => {
      setForm({
        tone: voice.tone ?? '',
        vocabulary: voice.vocabulary ?? '',
        doList: voice.doList ?? '',
        dontList: voice.dontList ?? '',
        examplePost: voice.examplePost ?? '',
      })
      setDirty(true)
      toast.success('Brand voice generated — review and save')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const field = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => { setForm(p => ({ ...p, [key]: e.target.value })); setDirty(true) }

  if (isLoading) return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-48 rounded" />
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 w-full rounded" />)}
    </div>
  )

  return (
    <>
      <PageHeader title="Brand Voice" description="Define how your brand communicates across all platforms."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />{aiMutation.isPending ? 'Generating…' : 'Generate with AI'}
            </Button>
            {dirty && (
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="mr-1.5 h-3.5 w-3.5" />{saveMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Tone & Style</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Input value={form.tone} onChange={field('tone')} placeholder="Professional yet approachable, witty, inspirational…" />
            </div>
            <div className="space-y-1.5">
              <Label>Vocabulary / Key Phrases</Label>
              <Textarea value={form.vocabulary} onChange={field('vocabulary')} className="resize-none h-24 text-sm"
                placeholder="Words and phrases you use, industry terms, brand-specific language…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Do&apos;s & Don&apos;ts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-success">✓ Do</Label>
              <Textarea value={form.doList} onChange={field('doList')} className="resize-none h-24 text-sm"
                placeholder="Use first-person plural, include CTAs, respond to comments…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-danger">✗ Don&apos;t</Label>
              <Textarea value={form.dontList} onChange={field('dontList')} className="resize-none h-24 text-sm"
                placeholder="Use jargon, make political statements, post without proofreading…" />
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Example Post</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={form.examplePost} onChange={field('examplePost')} className="resize-none h-28 text-sm"
              placeholder="Write an example post that perfectly captures your brand voice…" />
          </CardContent>
        </Card>
      </div>

      {dirty && (
        <div className="mt-6 flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="mr-1.5 h-3.5 w-3.5" />{saveMutation.isPending ? 'Saving…' : 'Save Brand Voice'}
          </Button>
        </div>
      )}
    </>
  )
}
