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
  Map, Activity, MessageCircle, Shield, Star, Mic, StickyNote, CheckCircle2, Zap, BookmarkCheck,
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
      { label: 'Saved Posts',      href: '/studio/saved',     icon: BookmarkCheck },
      { label: 'Sprint Planner',   href: '/studio/sprint',    icon: Zap },
      { label: 'Guardrails',       href: '/studio/guardrails', icon: ShieldCheck },
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
    label: 'Team Hub',
    items: [
      { label: 'Content Review',       href: '/team/review',   icon: CheckCircle2 },
      { label: 'Team Notes',           href: '/team/notes',    icon: StickyNote },
      { label: 'Meeting Intelligence', href: '/team/meetings', icon: Mic },
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
        {/* -- Collapse toggle */}
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
