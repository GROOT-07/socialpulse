import { useState, useCallback } from 'react'

export function useCopy(timeoutMs = 2000) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      // Layer 1: Modern clipboard API
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), timeoutMs)
        return true
      }

      // Layer 2: execCommand fallback
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)

      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), timeoutMs)
        return true
      }

      // Layer 3: dispatch event so CopyModal can show
      window.dispatchEvent(new CustomEvent('copy:fallback', { detail: { text } }))
      return false
    } catch {
      window.dispatchEvent(new CustomEvent('copy:fallback', { detail: { text } }))
      return false
    }
  }, [timeoutMs])

  return { copy, copied }
}
