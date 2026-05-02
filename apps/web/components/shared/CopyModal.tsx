'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Copy, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function CopyModal() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string }>
      setText(customEvent.detail.text)
      setOpen(true)
    }
    window.addEventListener('copy:fallback', handler)
    return () => window.removeEventListener('copy:fallback', handler)
  }, [])

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.select()
      }, 100)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-[var(--color-accent)]" />
            Copy to Clipboard
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-text-3)] mb-2">
          Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-xs font-mono">Ctrl+C</kbd> to copy the text below.
        </p>
        <textarea
          ref={textareaRef}
          readOnly
          value={text}
          className="w-full h-48 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-mono text-[var(--color-text)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
