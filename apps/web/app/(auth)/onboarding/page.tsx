'use client'

/**
 * Onboarding v2 — 4-step intelligent wizard (MODIFICATIONS_V2.md §1)
 *
 * Step 1: Business Identity (triggers OrgIntelligenceJob + CompetitorDiscoveryJob)
 * Step 2: Social Media Connections (URL scan via Data365, live preview cards)
 * Step 3: Confirm Auto-Discovered Data (org info + competitor list)
 * Step 4: Preferences + live job progress screen → /summary
 */

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Globe, MapPin, ArrowRight, CheckCircle2, Loader2,
  Instagram, Facebook, Youtube, MessageCircle, Search,
  ChevronDown, Star, Sparkles,
  Check, Bell, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { orgsApi, apiClient } from '@/lib/api'
import { toast } from 'sonner'

// ── Constants ─────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Business identity' },
  { id: 2, label: 'Social accounts' },
  { id: 3, label: 'Confirm data' },
  { id: 4, label: 'Launch' },
]

const INDUSTRIES = [
  'Healthcare / Medical Clinic', 'Dental Clinic', 'Pharmacy', 'Fitness & Gym',
  'Restaurant / Café', 'Bakery', 'Hotel & Hospitality', 'Real Estate',
  'Education / Coaching', 'Beauty Salon / Spa', 'Clothing & Fashion',
  'Electronics & Technology', 'Automobile', 'Legal Services', 'Financial Services',
  'Event Management', 'Interior Design', 'Photography / Videography',
  'Travel & Tourism', 'Supermarket / Grocery', 'Jewellery', 'Optical Store',
  'Diagnostic Lab', 'Veterinary', 'Yoga & Wellness', 'Catering', 'Architecture',
  'IT Services', 'Marketing Agency', 'Non-Profit / NGO', 'Other',
]

const PLATFORMS_CONFIG = [
  { key: 'INSTAGRAM', label: 'Instagram', color: 'var(--platform-instagram)', icon: Instagram, example: 'instagram.com/yourclinic or @yourclinic' },
  { key: 'FACEBOOK',  label: 'Facebook',  color: 'var(--platform-facebook)',  icon: Facebook,  example: 'facebook.com/yourpage' },
  { key: 'YOUTUBE',   label: 'YouTube',   color: 'var(--platform-youtube)',   icon: Youtube,   example: 'youtube.com/@yourchannel' },
  { key: 'WHATSAPP',  label: 'WhatsApp Business', color: 'var(--platform-whatsapp)', icon: MessageCircle, example: '+91 9876543210 or business page URL' },
  { key: 'GOOGLE',    label: 'Google Business', color: 'var(--platform-google)', icon: Search, example: 'g.co/kgs/... or business name' },
]

const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi']

// ── Types ─────────────────────────────────────────────────────

interface ScanResult {
  platform: string
  handle: string
  name: string
  followers: number
  profilePicUrl: string
  lastPostDate: string | null
  engagementRate: number
  status: 'scanning' | 'done' | 'error'
}

interface OrgIntelligenceData {
  googleKgData: { description?: string; name?: string } | null
  googlePlacesData: { rating?: number; userRatingsTotal?: number; formattedAddress?: string } | null
  detectedKeywords: string[]
  strengths: string[]
  urgentIssues: Array<{ issue: string; actionLink: string }>
  aiDiagnosis: { description?: string } | null
}

interface JobProgress {
  step: string
  status: 'pending' | 'running' | 'done' | 'error'
  message: string
}

// ── Step indicator ────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-normal',
                current > step.id
                  ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
                  : current === step.id
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-[var(--color-border-2)] bg-transparent text-[var(--color-text-4)]',
              )}
            >
              {current > step.id ? <CheckCircle2 className="h-4 w-4" /> : step.id}
            </div>
            <span
              className={cn(
                'text-[10px] font-medium whitespace-nowrap',
                current === step.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-4)]',
              )}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-16 mb-5 transition-all duration-normal',
                current > step.id + 1
                  ? 'bg-[var(--color-success)]'
                  : current > step.id
                  ? 'bg-[var(--color-accent)]'
                  : 'bg-[var(--color-border)]',
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Step 1: Business Identity ─────────────────────────────────

function Step1({ orgId, onNext }: { orgId: string; onNext: () => void }) {
  const [name, setName]               = useState('')
  const [industry, setIndustry]       = useState('')
  const [industryOpen, setIndustryOpen] = useState(false)
  const [industrySearch, setIndustrySearch] = useState('')
  const [city, setCity]               = useState('')
  const [country, setCountry]         = useState('India')
  const [website, setWebsite]         = useState('')
  const [businessType, setBusinessType] = useState('LOCAL')
  const [loading, setLoading]         = useState(false)

  const filteredIndustries = INDUSTRIES.filter((i) =>
    i.toLowerCase().includes(industrySearch.toLowerCase()),
  )

  const handleContinue = async () => {
    if (!name.trim() || !industry || !city.trim()) {
      toast.error('Please fill in your business name, industry, and city.')
      return
    }
    setLoading(true)
    try {
      // Update org with business identity
      await orgsApi.update(orgId, { name: name.trim(), industry, city, country, website: website || undefined })

      // Trigger background jobs immediately (non-blocking)
      void apiClient.post(`/api/orgs/${orgId}/jobs/intelligence`).catch(() => {})
      void apiClient.post(`/api/orgs/${orgId}/jobs/competitor-discovery`).catch(() => {})

      onNext()
    } catch {
      toast.error('Could not save business details. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[var(--color-text)] font-bold" style={{ fontSize: '22px' }}>
          Tell us about your business
        </h2>
        <p className="mt-1 text-[var(--color-text-3)] text-sm">
          Takes 30 seconds. We'll research the rest automatically.
        </p>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="orgName">Business name <span className="text-[var(--color-danger)]">*</span></Label>
          <Input
            id="orgName"
            placeholder="e.g. Aayu Clinic"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Industry */}
        <div className="space-y-1.5">
          <Label>Industry <span className="text-[var(--color-danger)]">*</span></Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIndustryOpen((v) => !v)}
              className={cn(
                'flex h-9 w-full items-center justify-between rounded px-3 text-sm',
                'border border-[var(--color-border-2)] bg-[var(--color-surface)]',
                'text-left transition-colors',
                industryOpen && 'border-[var(--color-accent)] shadow-[var(--shadow-accent)]',
                !industry && 'text-[var(--color-text-4)]',
              )}
            >
              {industry || 'Select your industry'}
              <ChevronDown className={cn('h-4 w-4 text-[var(--color-text-4)] transition-transform', industryOpen && 'rotate-180')} />
            </button>
            {industryOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
                <div className="p-2 border-b border-[var(--color-border)]">
                  <Input
                    placeholder="Search industry..."
                    value={industrySearch}
                    onChange={(e) => setIndustrySearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto py-1">
                  {filteredIndustries.map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => { setIndustry(ind); setIndustryOpen(false); setIndustrySearch('') }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-sm text-left',
                        'hover:bg-[var(--color-surface-2)] transition-colors',
                        industry === ind && 'text-[var(--color-accent)] font-medium',
                      )}
                    >
                      {industry === ind && <Check className="h-3.5 w-3.5 shrink-0" />}
                      {industry !== ind && <span className="w-3.5" />}
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* City + Country */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="city">City <span className="text-[var(--color-danger)]">*</span></Label>
            <Input
              id="city"
              placeholder="e.g. Hyderabad"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              placeholder="India"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <Label htmlFor="website">
            Website URL{' '}
            <span className="text-[10px] font-normal text-[var(--color-text-4)]">(optional but recommended)</span>
          </Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-4)]" />
            <Input
              id="website"
              placeholder="https://yourwebsite.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Business type */}
        <div className="space-y-1.5">
          <Label>Reach</Label>
          <div className="grid grid-cols-4 gap-2">
            {['LOCAL', 'REGIONAL', 'NATIONAL', 'GLOBAL'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setBusinessType(type)}
                className={cn(
                  'rounded px-3 py-2 text-xs font-medium border transition-all',
                  businessType === type
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent-text)]'
                    : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-3)] hover:border-[var(--color-border-2)]',
                )}
              >
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="rounded-lg border border-[var(--color-info-light)] bg-[var(--color-info-light)] px-4 py-3 flex gap-3 items-start">
        <Sparkles className="h-4 w-4 text-[var(--color-info)] mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--color-info-text)]">
          While you complete the next steps, we'll automatically research your business and find your top competitors.
        </p>
      </div>

      <Button onClick={handleContinue} disabled={loading} className="w-full h-10 font-semibold">
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
        ) : (
          <><ArrowRight className="h-4 w-4 mr-2" /> Continue</>
        )}
      </Button>
    </div>
  )
}

// ── Step 2: Social Media Connections ─────────────────────────

function Step2({ orgId, onNext }: { orgId: string; onNext: () => void }) {
  const [scanResults, setScanResults] = useState<Record<string, ScanResult>>({})
  const [urls, setUrls] = useState<Record<string, string>>({})

  const handleUrlChange = useCallback(
    async (platform: string, url: string) => {
      setUrls((prev) => ({ ...prev, [platform]: url }))

      // Validate format
      if (!url.trim() || url.length < 5) return

      // Show scanning state
      setScanResults((prev) => ({
        ...prev,
        [platform]: { platform, handle: '', name: '', followers: 0, profilePicUrl: '', lastPostDate: null, engagementRate: 0, status: 'scanning' },
      }))

      try {
        // Trigger scan job
        const res = await apiClient.post<{ scan: ScanResult }>(`/api/orgs/${orgId}/jobs/scan-profile`, {
          platform,
          profileUrl: url.trim(),
        })
        setScanResults((prev) => ({
          ...prev,
          [platform]: { ...res.scan, status: 'done' },
        }))
      } catch {
        setScanResults((prev) => ({
          ...prev,
          [platform]: { ...(prev[platform] ?? {} as ScanResult), status: 'error' },
        }))
      }
    },
    [orgId],
  )

  const connectedCount = Object.values(scanResults).filter((r) => r.status === 'done').length

  const handleContinue = () => {
    if (connectedCount === 0) {
      toast.error('Please connect at least one social media account.')
      return
    }
    onNext()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[var(--color-text)] font-bold" style={{ fontSize: '22px' }}>
          Connect your social pages
        </h2>
        <p className="mt-1 text-[var(--color-text-3)] text-sm">
          Just paste the URL. No passwords needed — we use public data.
        </p>
      </div>

      <div className="space-y-3">
        {PLATFORMS_CONFIG.map((p) => {
          const Icon = p.icon
          const result = scanResults[p.key]
          const url = urls[p.key] ?? ''

          return (
            <div key={p.key} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded"
                  style={{ background: `${p.color}1A` }}
                >
                  <Icon className="h-4 w-4" style={{ color: p.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">{p.label}</p>
                  <p className="text-[10px] text-[var(--color-text-4)]">{p.example}</p>
                </div>
                {result?.status === 'done' && (
                  <CheckCircle2 className="h-5 w-5 text-[var(--color-success)] shrink-0" />
                )}
              </div>

              <div className="px-4 pb-3">
                <div className="relative">
                  <Input
                    placeholder={p.example}
                    value={url}
                    onChange={(e) => handleUrlChange(p.key, e.target.value)}
                    className="pr-10 text-sm"
                  />
                  {result?.status === 'scanning' && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[var(--color-accent)]" />
                  )}
                  {result?.status === 'done' && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-success)]" />
                  )}
                </div>
              </div>

              {/* Live preview card */}
              {result?.status === 'done' && (
                <div className="mx-4 mb-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2.5 flex items-center gap-3">
                  {result.profilePicUrl ? (
                    <img src={result.profilePicUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.color }}>
                      {(result.name || result.handle).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text)] truncate">{result.name || `@${result.handle}`}</p>
                    <p className="text-xs text-[var(--color-text-3)]">
                      {result.followers.toLocaleString()} followers
                      {result.engagementRate > 0 && ` · ${result.engagementRate.toFixed(1)}% engagement`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[var(--color-success)] border-[var(--color-success)] text-[10px]">
                    Connected ✓
                  </Badge>
                </div>
              )}

              {result?.status === 'error' && (
                <div className="mx-4 mb-3 rounded-lg bg-[var(--color-danger-light)] px-3 py-2 text-xs text-[var(--color-danger-text)]">
                  Couldn't scan this profile. Check the URL format and try again.
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-[var(--color-text-4)]">
          {connectedCount} of {PLATFORMS_CONFIG.length} connected · minimum 1 required
        </p>
        <Button onClick={handleContinue} disabled={connectedCount === 0} className="gap-2">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ── Step 3: Your Business at a Glance ────────────────────────

function Step3({ orgId, onNext }: { orgId: string; onNext: () => void }) {
  const { activeOrg } = useOrgStore()
  const [showSkip, setShowSkip] = useState(false)

  // After 9 seconds, show "skip" nudge if data hasn't arrived yet
  useEffect(() => {
    const t = setTimeout(() => setShowSkip(true), 9_000)
    return () => clearTimeout(t)
  }, [])

  // Fetch intelligence — generated synchronously on backend if missing.
  // Never retry on error (backend always returns 200 now).
  const { data: intelligence, isLoading } = useQuery({
    queryKey: ['org-intelligence', orgId],
    queryFn: async () => {
      try {
        return await apiClient.get<OrgIntelligenceData>(`/api/orgs/${orgId}/intelligence`)
      } catch {
        return null // gracefully treat any error as "no data"
      }
    },
    retry: false,
    refetchInterval: false,
  })

  const hasContent = !!(
    intelligence?.aiDiagnosis?.description ||
    intelligence?.googlePlacesData?.formattedAddress ||
    (intelligence?.detectedKeywords?.length ?? 0) > 0 ||
    intelligence?.googlePlacesData?.rating !== undefined
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[var(--color-text)] font-bold" style={{ fontSize: '22px' }}>
          Here's what we found
        </h2>
        <p className="mt-1 text-[var(--color-text-3)] text-sm">
          We researched your business automatically — review what we discovered.
        </p>
      </div>

      {/* Intelligence card */}
      {isLoading && !hasContent ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--color-text-2)]">Researching your organization…</p>
            <p className="text-xs text-[var(--color-text-4)] mt-1">Checking Google, scanning your web presence</p>
          </div>
          {showSkip && (
            <div className="mt-2 rounded-lg border border-[var(--color-info-light)] bg-[var(--color-info-light)] px-4 py-2.5 text-xs text-[var(--color-info-text)] text-center max-w-xs">
              Analysis is running in the background — your dashboard will be fully ready when you launch.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)] overflow-hidden">
          {/* Business name / industry from org store as header */}
          <div className="px-5 py-4 flex items-center gap-3 bg-[var(--color-surface-2)]">
            <div className="h-10 w-10 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-[var(--color-accent)]">
                {(activeOrg?.name ?? 'B').charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">{activeOrg?.name}</p>
              <p className="text-xs text-[var(--color-text-4)]">{activeOrg?.industry}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-[var(--color-success)] ml-auto shrink-0" />
          </div>

          {/* AI-generated description */}
          {intelligence?.aiDiagnosis?.description && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-4)] mb-1.5">
                Business Overview
              </p>
              <p className="text-sm text-[var(--color-text-2)] leading-relaxed">
                {intelligence.aiDiagnosis.description}
              </p>
            </div>
          )}

          {/* Address */}
          {intelligence?.googlePlacesData?.formattedAddress && (
            <div className="px-5 py-3 flex items-start gap-3">
              <MapPin className="h-4 w-4 text-[var(--color-text-4)] mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-4)] mb-0.5">Address</p>
                <p className="text-sm text-[var(--color-text-2)]">{intelligence.googlePlacesData.formattedAddress}</p>
              </div>
            </div>
          )}

          {/* Google rating */}
          {intelligence?.googlePlacesData?.rating !== undefined && (
            <div className="px-5 py-3 flex items-center gap-3">
              <Star className="h-4 w-4 text-[var(--color-warning)] shrink-0" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {intelligence.googlePlacesData.rating?.toFixed(1)}
                </span>
                <span className="text-xs text-[var(--color-text-4)]">Google rating</span>
                {intelligence.googlePlacesData.userRatingsTotal !== undefined && (
                  <span className="text-xs text-[var(--color-text-4)]">
                    · {intelligence.googlePlacesData.userRatingsTotal.toLocaleString()} reviews
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Detected keywords */}
          {(intelligence?.detectedKeywords?.length ?? 0) > 0 && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-4)] mb-2">
                Detected keywords
              </p>
              <div className="flex flex-wrap gap-1.5">
                {intelligence!.detectedKeywords.slice(0, 10).map((kw) => (
                  <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Fallback if intelligence came back empty */}
          {!hasContent && (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-[var(--color-text-3)]">
                We're still analyzing your business in the background.
              </p>
              <p className="text-xs text-[var(--color-text-4)] mt-1">
                Full intelligence will be ready in your dashboard.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info note */}
      <div className="rounded-lg border border-[var(--color-info-light)] bg-[var(--color-info-light)] px-4 py-3 flex gap-3 items-start">
        <Sparkles className="h-4 w-4 text-[var(--color-info)] mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--color-info-text)]">
          Competitor discovery and SEO analysis are running in the background and will be ready when you reach your dashboard.
        </p>
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button onClick={onNext} className="gap-2">
          Looks good — Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ── Step 4: Preferences + Launch ──────────────────────────────

// Staggered step reveal timings (ms after launch)
const STEP_REVEAL_MS = [3000, 7000, 12000, 17000, 21000]
const REDIRECT_MS = 23000

const PROGRESS_STEPS_CONFIG = [
  { key: 'org-intelligence',     label: 'Organization profile built' },
  { key: 'competitor-discovery', label: 'Competitors discovered' },
  { key: 'seo-keywords',         label: 'SEO opportunities found' },
  { key: 'content-strategy',     label: 'Content strategy built' },
  { key: 'org-summary',          label: 'Dashboard prepared' },
]

function Step4({ orgId }: { orgId: string }) {
  const router = useRouter()
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(['INSTAGRAM', 'FACEBOOK', 'YOUTUBE']))
  const [language, setLanguage]   = useState('English')
  const [notifications, setNotifications] = useState(true)
  const [launched, setLaunched]   = useState(false)
  // doneSteps: number of steps visually marked done (timer-driven, not SSE-driven)
  const [doneSteps, setDoneSteps] = useState(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const handleLaunch = async () => {
    setLaunched(true)

    // Save preferences (non-blocking)
    orgsApi.update(orgId, { activePlatforms: [...platforms], language }).catch(() => {})

    // Queue all background jobs (non-blocking — we don't wait for them)
    apiClient.post(`/api/orgs/${orgId}/jobs/competitor-discovery`).catch(() => {})
    apiClient.post(`/api/orgs/${orgId}/jobs/seo-keywords`).catch(() => {})
    apiClient.post(`/api/orgs/${orgId}/jobs/content-strategy`).catch(() => {})
    apiClient.post(`/api/orgs/${orgId}/jobs/org-summary`).catch(() => {})

    // Stagger step completions visually
    STEP_REVEAL_MS.forEach((ms, idx) => {
      const t = setTimeout(() => setDoneSteps(idx + 1), ms)
      timersRef.current.push(t)
    })

    // Hard redirect — no SSE dependency, no callback chains
    const redirect = setTimeout(() => {
      router.push('/summary')
    }, REDIRECT_MS)
    timersRef.current.push(redirect)
  }

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout) }
  }, [])

  if (launched) {
    const allDone = doneSteps >= PROGRESS_STEPS_CONFIG.length
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-light)] mb-4">
            <Sparkles className="h-7 w-7 text-[var(--color-accent)]" />
          </div>
          <h2 className="text-[var(--color-text)] font-bold mb-1" style={{ fontSize: '22px' }}>
            {allDone ? 'Your dashboard is ready! 🎉' : 'Preparing your dashboard...'}
          </h2>
          <p className="text-sm text-[var(--color-text-3)]">
            {allDone ? 'Taking you there now...' : 'Setting everything up — just a few seconds.'}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)] overflow-hidden">
          {PROGRESS_STEPS_CONFIG.map((s, idx) => {
            const done = idx < doneSteps
            const running = idx === doneSteps
            return (
              <div key={s.key} className="flex items-center gap-3 px-4 py-3">
                <div className="h-6 w-6 shrink-0 flex items-center justify-center">
                  {done    && <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" />}
                  {running && <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />}
                  {!done && !running && <div className="h-5 w-5 rounded-full border-2 border-[var(--color-border-2)]" />}
                </div>
                <p className={cn('text-sm flex-1', done ? 'text-[var(--color-text)]' : 'text-[var(--color-text-3)]')}>
                  {s.label}
                </p>
              </div>
            )
          })}
        </div>

        <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700"
            style={{ width: `${(doneSteps / PROGRESS_STEPS_CONFIG.length) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[var(--color-text)] font-bold" style={{ fontSize: '22px' }}>
          Almost there!
        </h2>
        <p className="mt-1 text-[var(--color-text-3)] text-sm">
          Set your preferences and launch your personalized dashboard.
        </p>
      </div>

      {/* Active platforms */}
      <div className="space-y-2">
        <Label>Active platforms</Label>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS_CONFIG.slice(0, 4).map((p) => {
            const Icon = p.icon
            const active = platforms.has(p.key)
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPlatforms((prev) => {
                    const s = new Set(prev)
                    if (s.has(p.key)) s.delete(p.key)
                    else s.add(p.key)
                    return s
                  })
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all text-left',
                  active
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]'
                    : 'border-[var(--color-border)] bg-transparent',
                )}
              >
                {active
                  ? <ToggleRight className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
                  : <ToggleLeft  className="h-4 w-4 text-[var(--color-text-4)] shrink-0" />
                }
                <Icon className="h-4 w-4 shrink-0" style={{ color: active ? p.color : 'var(--color-text-4)' }} />
                <span className={active ? 'text-[var(--color-accent-text)] font-medium' : 'text-[var(--color-text-3)]'}>
                  {p.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Language */}
      <div className="space-y-2">
        <Label>Content language</Label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                language === lang
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent-text)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-3)] hover:border-[var(--color-border-2)]',
              )}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Bell className="h-4 w-4 text-[var(--color-text-3)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">Daily brief notifications</p>
            <p className="text-xs text-[var(--color-text-4)]">Get a morning summary every day at 7 AM</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setNotifications((v) => !v)}
          className="shrink-0"
        >
          {notifications
            ? <ToggleRight className="h-7 w-7 text-[var(--color-accent)]" />
            : <ToggleLeft  className="h-7 w-7 text-[var(--color-text-4)]" />
          }
        </button>
      </div>

      <Button onClick={handleLaunch} className="w-full h-11 font-semibold text-base gap-2">
        <Sparkles className="h-5 w-5" />
        Launch my dashboard
      </Button>
    </div>
  )
}

// ── Main onboarding page ──────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const { activeOrg } = useOrgStore()
  const orgId = activeOrg?.id ?? ''

  if (!orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text-3)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading your organization...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-[var(--color-bg)] px-4 py-12">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold text-[var(--color-text)]">SocialPulse</span>
      </div>

      <div className="w-full max-w-2xl">
        <StepIndicator current={step} />

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-lg)]">
          {step === 1 && <Step1 orgId={orgId} onNext={() => setStep(2)} />}
          {step === 2 && <Step2 orgId={orgId} onNext={() => setStep(3)} />}
          {step === 3 && <Step3 orgId={orgId} onNext={() => setStep(4)} />}
          {step === 4 && <Step4 orgId={orgId} />}
        </div>
      </div>
    </div>
  )
}
