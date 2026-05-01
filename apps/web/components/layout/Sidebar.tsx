'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Newspaper, BarChart2, Instagram, Facebook, Youtube,
  Users2, GitCompare, Eye, Target, UserCircle2, Megaphone, Layers,
  CalendarDays, CheckSquare, Lightbulb, ClipboardCheck, BookOpen,
  Settings, Link2, ShieldCheck, ChevronDown, ChevronsLeft, ChevronsRight,
  Building2, Sparkles, FileText, Video, Search, TrendingUp,
  Map, Activity, MessageCircle, Shield, Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { getInitials } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ── Nav structure (MODIFICATIONS_V2 §8) ───────────────────────
const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard',            href: '/',            icon: LayoutDashboard },
      { label: 'Organization Summary', href: '/summary',     icon: Activity },
      { label: 'Reputation',           href: '/reputation',  icon: Shield },
      { label: 'Daily Brief',          href: '/brief',       icon: Newspaper },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Social Overview', href: '/analytics',           icon: BarChart2 },
      { label: 'Instagram',       href: '/analytics/instagram', icon: Instagram },
      { label: 'Facebook',        href: '/analytics/facebook',  icon: Facebook },
      { label: 'YouTube',         href: '/analytics/youtube',   icon: Youtube },
      { label: 'WhatsApp',        href: '/analytics/whatsapp',  icon: MessageCircle },
      { label: 'Search & SEO',    href: '/analytics/seo',       icon: Search },
    ],
  },
  {
    label: 'Competitor Intelligence',
    items: [
      { label: 'Competitors',   href: '/competitors',              icon: Users2 },
      { label: 'Gap Analysis',  href: '/competitors/gap-analysis', icon: GitCompare },
      { label: 'Content Spy',   href: '/competitors/content',      icon: Eye },
      { label: 'Local Map',     href: '/competitors/map',          icon: Map },
    ],
  },
  {
    label: 'Content Studio',
    items: [
      { label: 'Post Generator',   href: '/studio/posts',     icon: Sparkles },
      { label: 'Video & Reels',    href: '/studio/video',     icon: Video },
      { label: 'Blog & Articles',  href: '/studio/blog',      icon: FileText },
      { label: 'Smart Calendar',   href: '/studio/calendar',  icon: CalendarDays },
      { label: 'SEO Planner',      href: '/studio/seo',       icon: Search },
      { label: 'Trending Now',     href: '/studio/trends',    icon: TrendingUp },
    ],
  },
  {
    label: 'Strategy',
    items: [
      { label: 'Goals & KPIs',    href: '/strategy/goals',    icon: Target },
      { label: 'Personas',        href: '/strategy/personas', icon: UserCircle2 },
      { label: 'Brand Voice',     href: '/strategy/voice',    icon: Megaphone },
      { label: 'Content Pillars', href: '/strategy/pillars',  icon: Layers },
    ],
  },
  {
    label: 'Execution',
    items: [
      { label: 'Outreach Checklist', href: '/checklist', icon: CheckSquare },
      { label: 'Ideas Bank',         href: '/ideas',      icon: Lightbulb },
      { label: 'Profile Audit',      href: '/audit',      icon: ClipboardCheck },
    ],
  },
  {
    label: 'Playbook',
    items: [
      { label: 'View Playbook', href: '/playbook', icon: BookOpen },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Settings',           href: '/settings',          icon: Settings },
      { label: 'Connected Accounts', href: '/settings/accounts', icon: Link2 },
      { label: 'Team Members',       href: '/settings/team',     icon: Users2 },
      { label: 'Admin Panel',        href: '/admin',             icon: ShieldCheck },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { activeOrg } = useOrgStore()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          'relative flex h-full flex-col border-r border-brand-border bg-surface transition-[width] duration-normal',
          collapsed ? 'w-14' : 'w-sidebar',
        )}
      >
        {/* ── Org switcher ───────────────────────────────── */}
        <div className={cn('flex h-14 items-center border-b border-brand-border', collapsed ? 'justify-center px-0' : 'px-3 gap-2')}>
          {/* Org logo / initials */}
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded font-semibold text-xs text-white"
            style={{ backgroundColor: activeOrg?.brandColor ?? 'var(--color-accent)' }}
          >
            {activeOrg ? getInitials(activeOrg.name) : <Building2 className="h-4 w-4" />}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                  {activeOrg?.name ?? 'No org selected'}
                </p>
                <p className="truncate text-[10px] text-[var(--color-text-4)]">
                  {activeOrg?.industry ?? '—'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-4)]" />
            </>
          )}
        </div>

        {/* ── Nav items ──────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-1">
              {/* Section label — hidden when collapsed */}
              {!collapsed && (
                <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[1.5px] text-[var(--color-text-4)]">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="my-1 mx-2 h-px bg-brand-border" />}

              {section.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)

                const navItem = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative mx-2 flex h-8 items-center gap-2 rounded px-2 text-sm transition-colors duration-instant',
                      active
                        ? 'nav-active'
                        : 'text-[var(--color-text-3)] hover:bg-surface-2 hover:text-[var(--color-text-2)]',
                      collapsed && 'justify-center px-0 w-10 mx-auto',
                    )}
                  >
                    {/* Active left border */}
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-accent" />
                    )}
                    <Icon
                      className={cn('shrink-0', collapsed ? 'h-[18px] w-[18px]' : 'h-4 w-4')}
                      aria-hidden="true"
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  )
                }

                return navItem
              })}
            </div>
          ))}
        </nav>

        {/* ── Collapse toggle ─────────────────────────────── */}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-10 items-center justify-center border-t border-brand-border text-[var(--color-text-4)] hover:text-[var(--color-text-3)] transition-colors duration-instant"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </aside>
    </TooltipProvider>
  )
}
