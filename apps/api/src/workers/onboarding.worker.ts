/**
 * Onboarding intelligence workers (V2)
 * Handles all 6 onboarding background jobs:
 *   1. OrgIntelligenceJob
 *   2. SocialProfileScanJob
 *   3. CompetitorDiscoveryJob
 *   4. SEOKeywordDiscoveryJob
 *   5. ContentStrategyGenerationJob
 *   6. OrgSummaryGenerationJob
 *
 * Progress events published to Redis for SSE consumption.
 */

import { Worker, type Job } from 'bullmq'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'
import { aiService } from '../services/ai/aiService'
import { discoverCompetitors } from '../services/competitor/competitorDiscoveryService'
import { discoverKeywords, calculatePresenceScore } from '../services/seo/seoIntelligenceService'
import { searchKnowledgeGraph, findPlace } from '../lib/googleApis'
import {
  getInstagramCompetitorProfile,
  getFacebookCompetitorProfile,
  getYouTubeCompetitorProfile,
} from '../services/competitor/data365Service'
import {
  orgIntelligenceQueue,
  socialProfileScanQueue,
  competitorDiscoveryQueue,
  seoKeywordDiscoveryQueue,
  contentStrategyQueue,
  orgSummaryQueue,
  type OrgIntelligenceJobData,
  type SocialProfileScanJobData,
  type CompetitorDiscoveryJobData,
  type SEOKeywordDiscoveryJobData,
  type ContentStrategyJobData,
  type OrgSummaryJobData,
} from '../lib/queue'
import { Platform, Prisma } from '@prisma/client'

// ── SSE progress helper ───────────────────────────────────────

async function emitProgress(orgId: string, step: string, status: 'pending' | 'running' | 'done' | 'error', message?: string): Promise<void> {
  const key = `sse:progress:${orgId}`
  const payload = JSON.stringify({ step, status, message, ts: Date.now() })
  await redis.lpush(key, payload)
  await redis.expire(key, 3600) // 1 hour TTL
  // Also publish to Redis pub/sub for live SSE streams
  await redis.publish(`progress:${orgId}`, payload)
}

// ── Worker 1: OrgIntelligenceJob ──────────────────────────────

const orgIntelligenceWorker = new Worker<OrgIntelligenceJobData>(
  'org-intelligence',
  async (job: Job<OrgIntelligenceJobData>) => {
    const { orgId } = job.data
    await emitProgress(orgId, 'org-intelligence', 'running', 'Researching your organization...')

    try {
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { name: true, industry: true, city: true, website: true },
      })

      // Fetch Knowledge Graph data
      const kgData = await searchKnowledgeGraph(`${org.name} ${org.industry}`)

      // Fetch Google Places data
      const placesData = org.city ? await findPlace(org.name, org.city) : null

      // Build AI synthesis prompt
      const prompt = `You are analyzing a business for a social media platform.

Business: ${org.name}
Industry: ${org.industry}
City: ${org.city ?? 'Unknown'}
Website: ${org.website ?? 'Not provided'}

Google Knowledge Graph: ${JSON.stringify(kgData ?? {})}
Google Places: ${JSON.stringify(placesData ?? {})}

Generate a JSON object with:
{
  "description": "2-3 sentence description of this business",
  "strengths": ["strength1", "strength2", "strength3"],
  "urgentIssues": [{"issue": "...", "actionLink": "/checklist"}, ...],
  "quickWins": [{"action": "...", "impact": "+15% engagement expected"}, ...],
  "detectedKeywords": ["keyword1", "keyword2", ...]
}

Return JSON only.`

      const aiResponse = await aiService.complete(prompt, 1000)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      const aiData = jsonMatch ? JSON.parse(jsonMatch[0]) as {
        description: string
        strengths: string[]
        urgentIssues: unknown[]
        quickWins: unknown[]
        detectedKeywords: string[]
      } : {
        description: `${org.name} is a ${org.industry} business based in ${org.city ?? 'India'}.`,
        strengths: [],
        urgentIssues: [],
        quickWins: [],
        detectedKeywords: [],
      }

      await prisma.orgIntelligence.upsert({
        where: { orgId },
        create: {
          orgId,
          googleKgData: (kgData ?? {}) as unknown as Prisma.InputJsonValue,
          googlePlacesData: (placesData ?? {}) as unknown as Prisma.InputJsonValue,
          detectedKeywords: aiData.detectedKeywords ?? [],
          strengths: aiData.strengths ?? [],
          urgentIssues: (aiData.urgentIssues ?? []) as unknown as Prisma.InputJsonValue,
          quickWins: (aiData.quickWins ?? []) as unknown as Prisma.InputJsonValue,
          aiDiagnosis: { description: aiData.description } as unknown as Prisma.InputJsonValue,
          presenceScore: 0,
          lastScannedAt: new Date(),
        },
        update: {
          googleKgData: (kgData ?? {}) as unknown as Prisma.InputJsonValue,
          googlePlacesData: (placesData ?? {}) as unknown as Prisma.InputJsonValue,
          detectedKeywords: aiData.detectedKeywords ?? [],
          strengths: aiData.strengths ?? [],
          urgentIssues: (aiData.urgentIssues ?? []) as unknown as Prisma.InputJsonValue,
          quickWins: (aiData.quickWins ?? []) as unknown as Prisma.InputJsonValue,
          aiDiagnosis: { description: aiData.description } as unknown as Prisma.InputJsonValue,
          lastScannedAt: new Date(),
        },
      })

      // Also update org description from KG
      if (kgData?.description) {
        await prisma.organization.update({
          where: { id: orgId },
          data: {},
        })
      }

      await emitProgress(orgId, 'org-intelligence', 'done', 'Organization profile built')
    } catch (err) {
      await emitProgress(orgId, 'org-intelligence', 'error', String(err))
      throw err
    }
  },
  { connection: redis, concurrency: 3 },
)

// ── Worker 2: SocialProfileScanJob ───────────────────────────

const socialProfileScanWorker = new Worker<SocialProfileScanJobData>(
  'social-profile-scan',
  async (job: Job<SocialProfileScanJobData>) => {
    const { orgId, platform, profileUrl } = job.data
    await emitProgress(orgId, `scan-${platform.toLowerCase()}`, 'running', `Scanning ${platform}...`)

    try {
      const handle = extractHandle(profileUrl, platform)
      if (!handle) {
        await emitProgress(orgId, `scan-${platform.toLowerCase()}`, 'error', 'Invalid profile URL')
        return
      }

      let profile = null
      if (platform === 'INSTAGRAM') {
        profile = await getInstagramCompetitorProfile(handle)
      } else if (platform === 'FACEBOOK') {
        profile = await getFacebookCompetitorProfile(handle)
      } else if (platform === 'YOUTUBE') {
        profile = await getYouTubeCompetitorProfile(handle)
      }

      if (!profile) {
        await emitProgress(orgId, `scan-${platform.toLowerCase()}`, 'done', 'Profile not found')
        return
      }

      const platformEnum = platform as Platform

      // Upsert social account
      const account = await prisma.socialAccount.upsert({
        where: { orgId_platform: { orgId, platform: platformEnum } },
        create: {
          orgId,
          platform: platformEnum,
          handle: profile.handle,
          profileUrl,
        },
        update: {
          handle: profile.handle,
          profileUrl,
        },
      })

      // Store initial metrics snapshot
      await prisma.socialMetrics.upsert({
        where: {
          socialAccountId_snapshotDate: {
            socialAccountId: account.id,
            snapshotDate: new Date(new Date().toISOString().split('T')[0] ?? new Date()),
          },
        },
        create: {
          socialAccountId: account.id,
          snapshotDate: new Date(new Date().toISOString().split('T')[0] ?? new Date()),
          followers: profile.followers,
          following: profile.following,
          posts: profile.postsCount,
          rawJson: profile as unknown as Prisma.InputJsonValue,
        },
        update: {
          followers: profile.followers,
          following: profile.following,
          posts: profile.postsCount,
        },
      })

      await emitProgress(
        orgId,
        `scan-${platform.toLowerCase()}`,
        'done',
        `${platform} connected — ${profile.followers.toLocaleString()} followers`,
      )
    } catch (err) {
      await emitProgress(orgId, `scan-${platform.toLowerCase()}`, 'error', String(err))
    }
  },
  { connection: redis, concurrency: 5 },
)

// ── Worker 3: CompetitorDiscoveryJob ─────────────────────────

const competitorDiscoveryWorker = new Worker<CompetitorDiscoveryJobData>(
  'competitor-discovery',
  async (job: Job<CompetitorDiscoveryJobData>) => {
    const { orgId } = job.data

    // Handle ALL orgs weekly refresh
    if (orgId === 'ALL') {
      const orgs = await prisma.organization.findMany({ select: { id: true } })
      for (const org of orgs) {
        await competitorDiscoveryQueue.add('discover', { orgId: org.id })
      }
      return
    }

    await emitProgress(orgId, 'competitor-discovery', 'running', 'Discovering competitors...')

    try {
      await discoverCompetitors(orgId)
      const count = await prisma.competitor.count({ where: { orgId } })
      await emitProgress(
        orgId,
        'competitor-discovery',
        'done',
        `${count} competitors discovered`,
      )
    } catch (err) {
      await emitProgress(orgId, 'competitor-discovery', 'error', String(err))
      throw err
    }
  },
  { connection: redis, concurrency: 2 },
)

// ── Worker 4: SEOKeywordDiscoveryJob ─────────────────────────

const seoKeywordDiscoveryWorker = new Worker<SEOKeywordDiscoveryJobData>(
  'seo-keyword-discovery',
  async (job: Job<SEOKeywordDiscoveryJobData>) => {
    const { orgId } = job.data

    if (orgId === 'ALL') {
      const orgs = await prisma.organization.findMany({ select: { id: true } })
      for (const org of orgs) {
        await seoKeywordDiscoveryQueue.add('discover-keywords', { orgId: org.id })
      }
      return
    }

    await emitProgress(orgId, 'seo-keywords', 'running', 'Finding SEO opportunities...')

    try {
      await discoverKeywords(orgId)
      const count = await prisma.keywordOpportunity.count({ where: { orgId } })
      await emitProgress(orgId, 'seo-keywords', 'done', `${count} keyword opportunities found`)
    } catch (err) {
      await emitProgress(orgId, 'seo-keywords', 'error', String(err))
      throw err
    }
  },
  { connection: redis, concurrency: 2 },
)

// ── Worker 5: ContentStrategyGenerationJob ───────────────────

const contentStrategyWorker = new Worker<ContentStrategyJobData>(
  'content-strategy-generation',
  async (job: Job<ContentStrategyJobData>) => {
    const { orgId } = job.data
    await emitProgress(orgId, 'content-strategy', 'running', 'Building your content strategy...')

    try {
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        include: {
          competitors: { where: { status: 'CONFIRMED' }, take: 5 },
          keywordOpportunities: { orderBy: { searchVolume: 'desc' }, take: 10 },
          orgIntelligence: true,
        },
      })

      const prompt = `You are a social media strategist creating a complete content strategy for ${org.name}, a ${org.industry} business in ${org.city ?? 'India'}.

Top keywords: ${org.keywordOpportunities.map((k) => k.keyword).join(', ')}
Competitors: ${org.competitors.map((c) => c.businessName ?? c.handle).join(', ')}
AI insights: ${JSON.stringify(org.orgIntelligence?.aiDiagnosis ?? {})}

Generate a JSON object with:
{
  "contentPillars": [
    {
      "title": "Pillar name",
      "description": "2-sentence description",
      "colorHex": "#hex",
      "postingRatio": 25,
      "exampleFormats": ["Reel", "Carousel"],
      "captionStarters": ["starter1", "starter2", "starter3"]
    }
  ],
  "brandVoice": {
    "adjectives": ["word1", "word2", "word3", "word4", "word5"],
    "personality": "The [Archetype]",
    "dos": ["Do 1", "Do 2", "Do 3"],
    "donts": ["Don't 1", "Don't 2", "Don't 3"],
    "captionGood": "example good caption",
    "captionBad": "example bad caption"
  },
  "audiencePersonas": [
    {
      "name": "Persona Name",
      "ageRange": "25-35",
      "gender": "Female",
      "location": "${org.city ?? 'City'}",
      "interests": ["interest1", "interest2"],
      "painPoints": ["pain1", "pain2"],
      "contentPreference": "Description"
    }
  ]
}

Include 4-6 content pillars. Return JSON only.`

      const response = await aiService.complete(prompt, 2000)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI returned invalid JSON for content strategy')

      const strategy = JSON.parse(jsonMatch[0]) as {
        contentPillars: Array<{
          title: string
          description: string
          colorHex: string
          postingRatio: number
          exampleFormats: string[]
          captionStarters: string[]
        }>
        brandVoice: {
          adjectives: string[]
          personality: string
          dos: string[]
          donts: string[]
          captionGood: string
          captionBad: string
        }
        audiencePersonas: Array<{
          name: string
          ageRange: string
          gender: string
          location: string
          interests: string[]
          painPoints: string[]
          contentPreference: string
        }>
      }

      // Create content pillars
      for (const pillar of (strategy.contentPillars ?? [])) {
        await prisma.contentPillar.create({
          data: {
            orgId,
            title: pillar.title,
            description: pillar.description,
            colorHex: pillar.colorHex ?? '#4F6EF7',
            postingRatio: pillar.postingRatio ?? 25,
            exampleFormats: pillar.exampleFormats ?? [],
            captionStarters: pillar.captionStarters ?? [],
          },
        })
      }

      // Create brand voice
      if (strategy.brandVoice) {
        const bv = strategy.brandVoice
        await prisma.brandVoice.upsert({
          where: { orgId },
          create: {
            orgId,
            adjectives: bv.adjectives ?? [],
            personality: bv.personality,
            dos: bv.dos ?? [],
            donts: bv.donts ?? [],
            captionGood: bv.captionGood,
            captionBad: bv.captionBad,
            aiGenerated: true,
          },
          update: {
            adjectives: bv.adjectives ?? [],
            personality: bv.personality,
            dos: bv.dos ?? [],
            donts: bv.donts ?? [],
            captionGood: bv.captionGood,
            captionBad: bv.captionBad,
            aiGenerated: true,
          },
        })
      }

      // Create audience personas
      for (const persona of (strategy.audiencePersonas ?? [])) {
        await prisma.persona.create({
          data: {
            orgId,
            name: persona.name,
            ageRange: persona.ageRange,
            gender: persona.gender,
            location: persona.location,
            interests: persona.interests ?? [],
            platforms: org.activePlatforms,
            painPoints: persona.painPoints ?? [],
            contentPreference: persona.contentPreference,
            aiGenerated: true,
          },
        })
      }

      await emitProgress(orgId, 'content-strategy', 'done', 'Content strategy ready')
    } catch (err) {
      await emitProgress(orgId, 'content-strategy', 'error', String(err))
      throw err
    }
  },
  { connection: redis, concurrency: 2 },
)

// ── Worker 6: OrgSummaryGenerationJob ────────────────────────

const orgSummaryWorker = new Worker<OrgSummaryJobData>(
  'org-summary-generation',
  async (job: Job<OrgSummaryJobData>) => {
    const { orgId } = job.data
    await emitProgress(orgId, 'org-summary', 'running', 'Building your organization summary...')

    try {
      const presenceScore = await calculatePresenceScore(orgId)

      // Generate 30-day roadmap
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        include: {
          orgIntelligence: true,
          contentPillars: { take: 6 },
          competitors: { where: { status: 'CONFIRMED' }, take: 5 },
        },
      })

      const prompt = `Create a 30-day social media and SEO growth roadmap for ${org.name} (${org.industry} in ${org.city ?? 'India'}).

Quick wins: ${JSON.stringify((org.orgIntelligence?.quickWins ?? []))}
Urgent issues: ${JSON.stringify((org.orgIntelligence?.urgentIssues ?? []))}
Content pillars: ${org.contentPillars.map((p) => p.title).join(', ')}

Return a JSON object:
{
  "weeks": [
    {
      "week": 1,
      "theme": "Week theme",
      "actions": [{"day": "Mon", "action": "...", "platform": "INSTAGRAM", "type": "CONTENT"}]
    }
  ]
}

Include 4 weeks, ~5 actions per week. Return JSON only.`

      const response = await aiService.complete(prompt, 1500)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      const roadmap = jsonMatch ? JSON.parse(jsonMatch[0]) as unknown : {}

      // Store in PlaybookSection as ORG_SUMMARY
      await prisma.playbookSection.upsert({
        where: { orgId_sectionType: { orgId, sectionType: 'ORG_SUMMARY' } },
        create: {
          orgId,
          sectionType: 'ORG_SUMMARY',
          generatedByAI: true,
          content: {
            presenceScore,
            diagnosis: org.orgIntelligence?.aiDiagnosis ?? {},
            strengths: org.orgIntelligence?.strengths ?? [],
            urgentIssues: org.orgIntelligence?.urgentIssues ?? [],
            quickWins: org.orgIntelligence?.quickWins ?? [],
            roadmap,
            generatedAt: new Date().toISOString(),
          } as unknown as Prisma.InputJsonValue,
        },
        update: {
          generatedByAI: true,
          content: {
            presenceScore,
            diagnosis: org.orgIntelligence?.aiDiagnosis ?? {},
            strengths: org.orgIntelligence?.strengths ?? [],
            urgentIssues: org.orgIntelligence?.urgentIssues ?? [],
            quickWins: org.orgIntelligence?.quickWins ?? [],
            roadmap,
            generatedAt: new Date().toISOString(),
          } as unknown as Prisma.InputJsonValue,
        },
      })

      await emitProgress(orgId, 'org-summary', 'done', 'Your dashboard is ready!')
    } catch (err) {
      await emitProgress(orgId, 'org-summary', 'error', String(err))
      throw err
    }
  },
  { connection: redis, concurrency: 2 },
)

// ── Error handlers ────────────────────────────────────────────

for (const worker of [
  orgIntelligenceWorker,
  socialProfileScanWorker,
  competitorDiscoveryWorker,
  seoKeywordDiscoveryWorker,
  contentStrategyWorker,
  orgSummaryWorker,
]) {
  worker.on('error', (err) => {
    console.error(`[onboarding-worker] error:`, err.message)
  })
}

export {
  orgIntelligenceWorker,
  socialProfileScanWorker,
  competitorDiscoveryWorker,
  seoKeywordDiscoveryWorker,
  contentStrategyWorker,
  orgSummaryWorker,
}

// ── Helper ────────────────────────────────────────────────────

function extractHandle(url: string, platform: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const parts = u.pathname.split('/').filter(Boolean)
    if (platform === 'INSTAGRAM' || platform === 'FACEBOOK') return parts[0] ?? null
    if (platform === 'YOUTUBE') {
      const idx = parts.findIndex((p) => ['channel', 'c', '@'].includes(p))
      return idx >= 0 ? (parts[idx + 1] ?? null) : (parts[0] ?? null)
    }
    return null
  } catch {
    return url.replace('@', '').split('/').pop() ?? null
  }
}
