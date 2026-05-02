'use client'

import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  guardrailsApi,
  type ContentGuardrail,
  type ContentGuardrail as GuardrailType,
} from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CATEGORIES = ['VOICE', 'LEGAL', 'PLATFORM', 'CONTENT', 'CULTURAL'] as const
const RULE_TYPES = ['DO', 'DONT', 'RULE', 'WARNING'] as const

interface EditingGuardrail {
  id: string
  text: string
}

export function GuardrailsPage() {
  const queryClient = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORIES)[number]>('VOICE')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingGuardrail, setEditingGuardrail] = useState<EditingGuardrail | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const [formData, setFormData] = useState({
    text: '',
    category: 'VOICE',
    ruleType: 'RULE',
    platform: '',
  })

  const { data: guardrails = [], isLoading } = useQuery({
    queryKey: ['guardrails'],
    queryFn: () => guardrailsApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      guardrailsApi.create({
        text: data.text,
        category: data.category,
        ruleType: data.ruleType,
        platform: data.platform || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardrails'] })
      setFormData({
        text: '',
        category: 'VOICE',
        ruleType: 'RULE',
        platform: '',
      })
      setIsAddDialogOpen(false)
      setShowAddForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      guardrailsApi.update(id, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardrails'] })
      setEditingGuardrail(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => guardrailsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardrails'] })
    },
  })

  const generateMutation = useMutation({
    mutationFn: () => guardrailsApi.generate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardrails'] })
      setIsRegenerating(false)
    },
    onError: () => {
      setIsRegenerating(false)
    },
  })

  const handleRegenerate = () => {
    setIsRegenerating(true)
    generateMutation.mutate()
  }

  const handleAddGuardrail = () => {
    if (!formData.text.trim()) return
    createMutation.mutate(formData)
  }

  const handleUpdateGuardrail = () => {
    if (!editingGuardrail || !editingGuardrail.text.trim()) return
    updateMutation.mutate({
      id: editingGuardrail.id,
      text: editingGuardrail.text,
    })
  }

  const handleDeleteGuardrail = (id: string) => {
    if (confirm('Are you sure you want to delete this guardrail?')) {
      deleteMutation.mutate(id)
    }
  }

  const groupedByCategory = useMemo(() => {
    const grouped: Record<string, GuardrailType[]> = {}
    CATEGORIES.forEach((cat) => {
      grouped[cat] = guardrails.filter((g) => g.category === cat)
    })
    return grouped
  }, [guardrails])

  const groupedByRuleType = useMemo(() => {
    const grouped: Record<string, GuardrailType[]> = {}
    const items = groupedByCategory[selectedCategory] || []
    RULE_TYPES.forEach((type) => {
      grouped[type] = items.filter((g) => g.ruleType === type)
    })
    return grouped
  }, [groupedByCategory, selectedCategory])

  const getRuleTypeColor = (
    ruleType: string,
  ): { border: string; text: string; bg: string } => {
    switch (ruleType) {
      case 'DO':
        return {
          border: 'border-l-2 border-[var(--color-success)]',
          text: 'text-[var(--color-success)]',
          bg: 'bg-[var(--color-surface-2)]',
        }
      case 'DONT':
        return {
          border: 'border-l-2 border-[var(--color-danger)]',
          text: 'text-[var(--color-danger)]',
          bg: 'bg-[var(--color-surface-2)]',
        }
      case 'RULE':
        return {
          border: 'border-l-2 border-[var(--color-warning)]',
          text: 'text-[var(--color-warning)]',
          bg: 'bg-[var(--color-surface-2)]',
        }
      case 'WARNING':
        return {
          border: 'border-l-2 border-orange-400',
          text: 'text-orange-600 dark:text-orange-400',
          bg: 'bg-[var(--color-surface-2)]',
        }
      default:
        return {
          border: '',
          text: 'text-[var(--color-text)]',
          bg: 'bg-[var(--color-surface-2)]',
        }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Content Guardrails" icon={ShieldCheck} />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <div className="h-4 w-24 bg-[var(--color-surface-2)] rounded animate-pulse" />
                <div className="h-3 w-full bg-[var(--color-surface-2)] rounded animate-pulse" />
                <div className="h-3 w-4/5 bg-[var(--color-surface-2)] rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const currentCategoryItems = groupedByCategory[selectedCategory] || []
  const isEmpty = currentCategoryItems.length === 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Content Guardrails"
        icon={ShieldCheck}
        actions={
          <Button
            onClick={handleRegenerate}
            variant="secondary"
            disabled={isRegenerating}
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate All'}
          </Button>
        }
      />

      {isRegenerating && (
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--color-text-2)]">
            Regenerating guardrails...
          </span>
        </div>
      )}

      <Tabs
        value={selectedCategory}
        onValueChange={(val) => setSelectedCategory(val as (typeof CATEGORIES)[number])}
        className="w-full"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((category) => (
          <TabsContent key={category} value={category} className="space-y-4">
            {isEmpty ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ShieldCheck className="h-12 w-12 text-[var(--color-text-4)] mb-3" />
                  <p className="text-sm font-medium text-[var(--color-text-2)] mb-2">
                    No {category} guardrails yet
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, category }))
                      setShowAddForm(true)
                      setIsAddDialogOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add guardrail
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-end">
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, category }))
                          setShowAddForm(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add guardrail
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Guardrail</DialogTitle>
                        <DialogDescription>
                          Create a new guardrail for your content team.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--color-text)]">
                            Rule Type
                          </label>
                          <Select
                            value={formData.ruleType}
                            onValueChange={(val) =>
                              setFormData((prev) => ({ ...prev, ruleType: val }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RULE_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--color-text)]">
                            Guardrail Text
                          </label>
                          <Textarea
                            value={formData.text}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                text: e.target.value,
                              }))
                            }
                            placeholder="Enter the guardrail text..."
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--color-text)]">
                            Platform (optional)
                          </label>
                          <Input
                            value={formData.platform}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                platform: e.target.value,
                              }))
                            }
                            placeholder="e.g., Instagram, Facebook"
                          />
                        </div>

                        <Button
                          onClick={handleAddGuardrail}
                          disabled={createMutation.isPending}
                          className="w-full"
                        >
                          {createMutation.isPending ? 'Adding...' : 'Add Guardrail'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3">
                  {RULE_TYPES.map((ruleType) => {
                    const items = groupedByRuleType[ruleType]
                    if (items.length === 0) return null

                    const colors = getRuleTypeColor(ruleType)

                    return (
                      <div key={ruleType}>
                        <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${colors.text}`}>
                          {ruleType}
                        </h3>
                        <div className="space-y-2">
                          {items.map((guardrail) =>
                            editingGuardrail?.id === guardrail.id ? (
                              <Card
                                key={guardrail.id}
                                className={`${colors.border}`}
                              >
                                <CardContent className="p-4 space-y-3">
                                  <Textarea
                                    value={editingGuardrail.text}
                                    onChange={(e) =>
                                      setEditingGuardrail({
                                        ...editingGuardrail,
                                        text: e.target.value,
                                      })
                                    }
                                    rows={3}
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingGuardrail(null)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={handleUpdateGuardrail}
                                      disabled={updateMutation.isPending}
                                    >
                                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ) : (
                              <Card
                                key={guardrail.id}
                                className={`${colors.border}`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 space-y-2 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className={colors.text}>
                                          {guardrail.ruleType}
                                        </Badge>
                                        {guardrail.platform && (
                                          <Badge variant="outline" className="text-xs">
                                            {guardrail.platform}
                                          </Badge>
                                        )}
                                        {guardrail.aiGenerated && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs text-[var(--color-text-3)]"
                                          >
                                            AI Generated
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-[var(--color-text)]">
                                        {guardrail.text}
                                      </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setEditingGuardrail({
                                            id: guardrail.id,
                                            text: guardrail.text,
                                          })
                                        }
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteGuardrail(guardrail.id)}
                                        disabled={deleteMutation.isPending}
                                      >
                                        <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
