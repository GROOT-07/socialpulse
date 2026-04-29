/**
 * CompetitorDiscoveryService — Multi-source automatic competitor discovery
 *
 * Runs on org creation and weekly via BullMQ cron.
 * Sources:
 *   1. Google Local Search (SerpAPI)
 *   2. Google Maps API (nearby businesses)
 *   3. Social Media Discovery (Data365)
 *   4. SEO Competitor Discovery (SerpAPI organic results)
 *   5. Claude AI Synthesis (rank + score final list)
 *
 * NEVER called directly from user requests — BullMQ workers only.
 */

import { prisma } from '../../lib/prisma'
import { aiService } from '../ai/aiService'
import {
  searchLocalBusinesses,
  searchOrganicResults,
  type LocalSearchResult,
  type OrganicSearchResult,
} from '../../lib/serpapi'
import { searchNearbyBusinesses, findPlace, type PlaceDetails } from '../../lib/googleApis'
import {
  getInstagramCompetitorProfile,
  getFacebookCompetitorProfile,
  getYouTubeCompetitorProfile,
} from './data365Service'
import { Platform, CompetitorStatus, CompetitorSource } from '@prisma/client'
import type { Prisma } from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────

interface DiscoveredCompetitor {
  businessName: string
  website: string | null
  address: string | null
  city: string | null
  platform: Platform
  handle: string
  profileUrl: string | null
  logoUrl: string | null
  relevanceScore: number
  source: CompetitorSource
  discoveryReason: string
}

interface OrgContext {
  id: string
  name: string
  industry: string
  city: string | null
  country: string | null
  website: string | null
  activePlatforms: Platform[]
}

// ── Main entry point ──────────────────────────────────────────

export async function discoverCompetitors(orgId: string): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      industry: true,
      city: true,
      country: true,
      website: true,
      activePlatforms: true,
    },
  })

  console.log(`[CompetitorDiscovery] Starting discovery for org: ${org.name}`)

  const allCandidates: DiscoveredCompetitor[] = []

  // Source 1 — Google Local Search
  const localResults = await runGoogleLocalSearch(org)
  allCandidates.push(...localResults)

  // Source 2 — Google Maps nearby
  const mapsResults = await runGoogleMapsSearch(org)
  allCandidates.push(...mapsResults)

  // Source 3 — Social Media Discovery
  const socialResults = await runSocialDiscovery(org)
  allCandidates.push(...socialResults)

  // Source 4 — SEO competitors
  const seoResults = await runSEOCompetitorSearch(org)
  allCandidates.push(...seoResults)

  if (allCandidates.length === 0) {
    console.warn(`[CompetitorDiscovery] No candidates found for org: ${org.name}`)
    return
  }

  // Source 5 — Claude AI Synthesis
  const rankedCompetitors = await rankCompetitorsWithAI(allCandidates, org)

  // Persist results
  await persistCompetitors(orgId, rankedCompetitors)

  console.log(
    `[CompetitorDiscovery] Discovered ${rankedCompetitors.length} competitors for org: ${org.name}`,
  )
}

// ── Source 1: Google Local Search ────────────────────────────

async function runGoogleLocalSearch(org: OrgContext): Promise<DiscoveredCompetitor[]> {
  if (!org.city) return []

  const results: LocalSearchResult[] = await searchLocalBusinesses(
    org.industry,
    `${org.city}${org.country ? ', ' + org.country : ''}`,
    15,
  )

  return results
    .filter((r) => r.title.toLowerCase() !== org.name.toLowerCase())
    .map((r) => ({
      businessName: r.title,
      website: r.website,
      address: r.address,
      city: org.city,
      platform: Platform.INSTAGRAM, // default; refined in social step
      handle: extractHandleFromWebsite(r.website) ?? r.title.toLowerCase().replace(/\s+/g, ''),
      profileUrl: r.website,
      logoUrl: null,
      relevanceScore: 60,
      source: CompetitorSource.GOOGLE_LOCAL,
      discoveryReason: `Found in Google local search for "${org.industry} in ${org.city}"`,
    }))
}

// ── Source 2: Google Maps Nearby ─────────────────────────────

async function runGoogleMapsSearch(org: OrgContext): Promise<DiscoveredCompetitor[]> {
  if (!org.city) return []

  // Try to get org coordinates first
  const orgPlace = await findPlace(org.name, org.city ?? '')
  if (!orgPlace?.lat || !orgPlace?.lng) return []

  const nearby: PlaceDetails[] = await searchNearbyBusinesses(
    org.industry,
    orgPlace.lat,
    orgPlace.lng,
    15000,
    10,
  )

  return nearby
    .filter((p) => p.name.toLowerCase() !== org.name.toLowerCase())
    .map((p) => ({
      businessName: p.name,
      website: p.website,
      address: p.formattedAddress,
      city: org.city,
      platform: Platform.INSTAGRAM,
      handle: extractHandleFromWebsite(p.website) ?? p.name.toLowerCase().replace(/\s+/g, ''),
      profileUrl: p.website,
      logoUrl: null,
      relevanceScore: 65,
      source: CompetitorSource.GOOGLE_MAPS,
      discoveryReason: `Found within 15km of your location via Google Maps`,
    }))
}

// ── Source 3: Social Media Discovery ─────────────────────────

async function runSocialDiscovery(org: OrgContext): Promise<DiscoveredCompetitor[]> {
  const candidates: DiscoveredCompetitor[] = []
  const platforms = org.activePlatforms.filter((p) =>
    [Platform.INSTAGRAM, Platform.FACEBOOK, Platform.YOUTUBE].includes(p),
  )

  // Use SerpAPI to find social media handles for local businesses
  const searchQuery = `${org.industry} ${org.city ?? ''} site:instagram.com OR site:facebook.com OR site:youtube.com`
  const organicResults: OrganicSearchResult[] = await searchOrganicResults(searchQuery, 10)

  for (const result of organicResults) {
    const platform = detectPlatform(result.link)
    if (!platform) continue
    if (!platforms.includes(platform)) continue

    const handle = extractSocialHandle(result.link, platform)
    if (!handle) continue

    candidates.push({
      businessName: result.title.split(' - ')[0] ?? result.title,
      website: result.link,
      address: null,
      city: org.city,
      platform,
      handle,
      profileUrl: result.link,
      logoUrl: null,
      relevanceScore: 70,
      source: CompetitorSource.SOCIAL_DISCOVERY,
      discoveryReason: `Found active on ${platform} in ${org.industry} niche`,
    })
  }

  return candidates
}

// ── Source 4: SEO Competitor Discovery ───────────────────────

async function runSEOCompetitorSearch(org: OrgContext): Promise<DiscoveredCompetitor[]> {
  const keywords = [
    `${org.industry} in ${org.city ?? 'India'}`,
    `best ${org.industry} ${org.city ?? ''}`,
    `${org.industry} services`,
  ]

  const domains = new Set<string>()
  const candidates: DiscoveredCompetitor[] = []

  for (const keyword of keywords) {
    const results: OrganicSearchResult[] = await searchOrganicResults(keyword, 10)
    for (const r of results) {
      if (r.domain && r.domain !== extractHandleFromWebsite(org.website ?? '') && !domains.has(r.domain)) {
        domains.add(r.domain)
        candidates.push({
          businessName: r.title.split(' - ')[0] ?? r.title,
          website: r.link,
          address: null,
          city: org.city,
          platform: Platform.GOOGLE,
          handle: r.domain,
          profileUrl: r.link,
          logoUrl: null,
          relevanceScore: 55,
          source: CompetitorSource.SEO_COMPETITOR,
          discoveryReason: `Ranks in top 10 Google results for "${keyword}"`,
        })
      }
    }
  }

  return candidates.slice(0, 10)
}

// ── Source 5: AI Synthesis ────────────────────────────────────

async function rankCompetitorsWithAI(
  candidates: DiscoveredCompetitor[],
  org: OrgContext,
): Promise<DiscoveredCompetitor[]> {
  if (candidates.length === 0) return []

  try {
    const prompt = `You are ranking competitor candidates for a business.

Organization:
- Name: ${org.name}
- Industry: ${org.industry}
- City: ${org.city ?? 'Unknown'}
- Platforms: ${org.activePlatforms.join(', ')}

Competitor candidates (${candidates.length} total):
${candidates
  .slice(0, 20)
  .map(
    (c, i) =>
      `${i + 1}. ${c.businessName} | ${c.platform} | @${c.handle} | Source: ${c.source} | ${c.discoveryReason}`,
  )
  .join('\n')}

Task: Return a JSON array of the top 10 most relevant competitors.
For each, assign a relevanceScore (0-100) based on:
- Same industry: +40 points
- Same geographic area: +30 points
- Similar size/presence: +20 points
- Content/keyword overlap: +10 points

Return format (JSON array only, no markdown):
[{"index": 1, "relevanceScore": 85, "discoveryReason": "Direct competitor in same city and industry with strong Instagram presence"}, ...]`

    const response = await aiService.complete(prompt, 1000)
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return deduplicateAndLimit(candidates, 10)

    const rankings = JSON.parse(jsonMatch[0]) as Array<{
      index: number
      relevanceScore: number
      discoveryReason: string
    }>

    return rankings
      .filter((r) => r.index > 0 && r.index <= candidates.length)
      .map((r) => ({
        ...candidates[r.index - 1]!,
        relevanceScore: r.relevanceScore,
        discoveryReason: r.discoveryReason,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10)
  } catch (err) {
    console.warn(`[CompetitorDiscovery] AI ranking failed, using rule-based: ${String(err)}`)
    return deduplicateAndLimit(candidates, 10)
  }
}

// ── Persist to DB ─────────────────────────────────────────────

async function persistCompetitors(
  orgId: string,
  competitors: DiscoveredCompetitor[],
): Promise<void> {
  for (const c of competitors) {
    try {
      await prisma.competitor.upsert({
        where: {
          orgId_platform_handle: {
            orgId,
            platform: c.platform,
            handle: c.handle,
          },
        },
        create: {
          orgId,
          platform: c.platform,
          handle: c.handle,
          profileUrl: c.profileUrl,
          businessName: c.businessName,
          logoUrl: c.logoUrl,
          address: c.address,
          city: c.city,
          website: c.website,
          relevanceScore: c.relevanceScore,
          status: CompetitorStatus.PENDING,
          source: c.source,
          discoveryReason: c.discoveryReason,
        },
        update: {
          businessName: c.businessName,
          relevanceScore: c.relevanceScore,
          discoveryReason: c.discoveryReason,
          source: c.source,
        } satisfies Prisma.CompetitorUpdateInput,
      })
    } catch (err) {
      console.warn(`[CompetitorDiscovery] Failed to persist competitor ${c.handle}: ${String(err)}`)
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function extractHandleFromWebsite(website: string | null): string | null {
  if (!website) return null
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    return url.hostname.replace('www.', '').split('.')[0] ?? null
  } catch {
    return null
  }
}

function detectPlatform(url: string): Platform | null {
  if (url.includes('instagram.com')) return Platform.INSTAGRAM
  if (url.includes('facebook.com')) return Platform.FACEBOOK
  if (url.includes('youtube.com')) return Platform.YOUTUBE
  return null
}

function extractSocialHandle(url: string, platform: Platform): string | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (platform === Platform.INSTAGRAM || platform === Platform.FACEBOOK) {
      return parts[0] ?? null
    }
    if (platform === Platform.YOUTUBE) {
      const idx = parts.findIndex((p) => p === 'channel' || p === 'c' || p === '@')
      return idx >= 0 ? parts[idx + 1] : (parts[0] ?? null)
    }
    return null
  } catch {
    return null
  }
}

function deduplicateAndLimit(
  candidates: DiscoveredCompetitor[],
  limit: number,
): DiscoveredCompetitor[] {
  const seen = new Set<string>()
  const unique: DiscoveredCompetitor[] = []
  for (const c of candidates) {
    const key = `${c.platform}:${c.handle.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(c)
    }
  }
  return unique.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit)
}
