import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Number formatting per BRAND_GUIDELINES §14 ──────────────

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.?0+$/, '')}K`
  return n.toLocaleString()
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

export function formatDelta(n: number): string {
  return n >= 0 ? `+${formatNumber(n)}` : formatNumber(n)
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(t: string): string {
  // Input: "14:30" → "14:30" (already 24h)
  return t
}

// ── Org slug ─────────────────────────────────────────────────

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// ── Platform display helpers ─────────────────────────────────

export const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  YOUTUBE: 'YouTube',
  WHATSAPP: 'WhatsApp',
  GOOGLE: 'Google',
}

export const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: 'var(--platform-instagram)',
  FACEBOOK: 'var(--platform-facebook)',
  YOUTUBE: 'var(--platform-youtube)',
  WHATSAPP: 'var(--platform-whatsapp)',
  GOOGLE: 'var(--platform-google)',
}

// ── Initials avatar helper ───────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
