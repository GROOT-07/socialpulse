'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  StickyNote, Plus, Sparkles, Trash2, Pencil, X, Check, RefreshCw, Loader2,
} from 'lucide-react'
import { teamApi, type ContentPieceItem } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// ── Note card ─────────────────────────────────────────────────

function NoteCard({
  note,
  onDelete,
  onEnhance,
  onSave,
  enhancing,
  saving,
}: {
  note: ContentPieceItem
  onDelete: () => void
  onEnhance: () => void
  onSave: (title: string, content: string) => void
  enhancing: boolean
  saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title)
  const [editContent, setEditContent] = useState(note.content)

  const handleSave = () => {
    onSave(editTitle, editContent)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditing(false)
  }

  return (
    <Card className="group hover:border-[var(--color-accent)]/30 transition-colors">
      <CardContent className="p-4">
        {editing ? (
          <div className="flex flex-col gap-3">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Note title…"
              className="font-semibold"
            />
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Note content…"
              rows={6}
              className="text-sm resize-none"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-7 gap-1 text-xs"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 text-xs">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                  {note.title}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-4)]">
                  {note.generatedByAI ? '✨ AI enhanced · ' : ''}
                  {new Date(note.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onEnhance}
                  disabled={enhancing}
                  title="Enhance with AI"
                  className="h-7 w-7"
                >
                  {enhancing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditing(true)}
                  className="h-7 w-7"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onDelete}
                  className="h-7 w-7 text-red-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--color-text-2)] leading-relaxed whitespace-pre-wrap line-clamp-6">
              {note.content}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Create note form ──────────────────────────────────────────

function CreateNoteForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const createMutation = useMutation({
    mutationFn: () => teamApi.createNote(title, content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team', 'notes'] })
      onClose()
    },
  })

  return (
    <Card className="border-[var(--color-accent)]/40">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-text)]">New Note</p>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title…"
          className="font-medium"
          autoFocus
        />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note here…"
          rows={5}
          className="text-sm resize-none"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || !content.trim() || createMutation.isPending}
            className="h-7 gap-1 text-xs"
          >
            {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Create Note
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function TeamNotesPage() {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [enhancingId, setEnhancingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const { data: notes = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['team', 'notes'],
    queryFn: () => teamApi.listNotes(),
    staleTime: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamApi.deleteNote(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['team', 'notes'] }),
  })

  const handleEnhance = async (id: string) => {
    setEnhancingId(id)
    try {
      await teamApi.enhanceNote(id)
      void qc.invalidateQueries({ queryKey: ['team', 'notes'] })
    } finally {
      setEnhancingId(null)
    }
  }

  const handleSave = async (id: string, title: string, content: string) => {
    setSavingId(id)
    try {
      await teamApi.updateNote(id, { title, content })
      void qc.invalidateQueries({ queryKey: ['team', 'notes'] })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Team Notes"
        description="Capture ideas, meeting minutes, and SOPs. AI can help you improve any note."
        icon={<StickyNote className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Note
            </Button>
          </div>
        }
      />

      {/* Loading */}
      {isLoading && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      )}

      {/* Notes grid */}
      {!isLoading && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {/* Create form as first card */}
          {creating && (
            <CreateNoteForm onClose={() => setCreating(false)} />
          )}

          {notes.length === 0 && !creating && (
            <div className="col-span-full">
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={<StickyNote className="h-12 w-12" />}
                    heading="No notes yet"
                    description="Create your first team note — meeting minutes, ideas, SOPs, or anything your team needs to remember."
                    action={{ label: 'Create First Note', onClick: () => setCreating(true) }}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={() => deleteMutation.mutate(note.id)}
              onEnhance={() => { void handleEnhance(note.id) }}
              onSave={(title, content) => { void handleSave(note.id, title, content) }}
              enhancing={enhancingId === note.id}
              saving={savingId === note.id}
            />
          ))}
        </div>
      )}
    </>
  )
}
