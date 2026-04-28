'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Sun, Moon, ChevronRight, LogOut, User, Settings } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useOrgStore } from '@/store/org.store'
import { getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ── Breadcrumb builder from pathname ─────────────────────────
function buildBreadcrumbs(pathname: string): Array<{ label: string; href: string }> {
  const LABELS: Record<string, string> = {
    '': 'Dashboard',
    brief: 'Daily brief',
    analytics: 'Analytics',
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube',
    competitors: 'Competitor intelligence',
    'gap-analysis': 'Gap analysis',
    content: 'Content spy',
    strategy: 'Strategy',
    goals: 'Goals & KPIs',
    personas: 'Personas',
    voice: 'Brand voice',
    pillars: 'Content pillars',
    calendar: 'Content calendar',
    checklist: 'Outreach checklist',
    ideas: 'Ideas bank',
    audit: 'Profile audit',
    playbook: 'Playbook',
    settings: 'Settings',
    org: 'Org settings',
    accounts: 'Connected accounts',
    team: 'Team members',
    admin: 'Admin panel',
  }

  const segments = pathname.split('/').filter(Boolean)
  const crumbs = [{ label: 'Dashboard', href: '/' }]

  segments.forEach((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    crumbs.push({ label: LABELS[seg] ?? seg, href })
  })

  return crumbs
}

export function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { user, clearAuth } = useAuthStore()
  const { activeOrg } = useOrgStore()

  const crumbs = buildBreadcrumbs(pathname)

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  return (
    <header
      className="flex h-topbar shrink-0 items-center justify-between border-b border-brand-border bg-surface px-6"
      style={{ zIndex: 10 }}
    >
      {/* ── Left: Breadcrumb ──────────────────────────── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <React.Fragment key={crumb.href}>
              {i > 0 && (
                <ChevronRight className="h-3 w-3 text-[var(--color-text-4)]" aria-hidden="true" />
              )}
              {isLast ? (
                <span className="text-sm font-medium text-[var(--color-text-2)]" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-sm text-[var(--color-text-4)] hover:text-[var(--color-text-3)] transition-colors duration-instant"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          )
        })}
      </nav>

      {/* ── Right: Org chip, Bell, Theme, User ─────────── */}
      <div className="flex items-center gap-2">
        {/* Org status chip */}
        {activeOrg && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-brand-border px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
            <span className="text-xs font-medium text-[var(--color-text-3)]">{activeOrg.name}</span>
          </div>
        )}

        {/* Notification bell */}
        <Button variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark'
            ? <Sun className="h-4 w-4" aria-hidden="true" />
            : <Moon className="h-4 w-4" aria-hidden="true" />
          }
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-full focus-visible:shadow-accent focus-visible:outline-none"
              aria-label="User menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={undefined} alt={user?.email ?? 'User'} />
                <AvatarFallback className="text-[10px]">
                  {user?.email ? getInitials(user.email.split('@')[0] ?? '') : 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="normal-case font-normal">
              <p className="text-sm font-medium text-[var(--color-text)]">{user?.email ?? 'User'}</p>
              <p className="text-xs text-[var(--color-text-4)] capitalize">{user?.role?.toLowerCase().replace('_', ' ') ?? ''}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/org" className="cursor-pointer">
                <Settings className="h-4 w-4" aria-hidden="true" /> Org settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-danger focus:text-danger focus:bg-danger-light cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
