import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4 py-12">
      {/* Soft background accent blob — per BRAND_GUIDELINES §11 marketing style */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-accent opacity-[0.07] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent opacity-[0.05] blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-bold text-sm">
              SP
            </span>
            <span className="text-xl font-bold text-[var(--color-text)]">SocialPulse</span>
          </span>
        </div>

        {children}
      </div>
    </div>
  )
}
