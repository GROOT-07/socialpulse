import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import type { Prisma } from '@prisma/client'

function org(req: AuthRequest): string { return (req.headers['x-org-id'] as string) || '' }

// ── Goals ─────────────────────────────────────────────────────

export async function listGoals(req: AuthRequest, res: Response): Promise<void> {
  const goals = await prisma.goal.findMany({ where: { orgId: org(req) }, orderBy: { createdAt: 'desc' } })
  res.json({ data: { goals } })
}

export async function createGoal(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as {
    title: string; description?: string; platform?: string
    metric?: string; targetValue?: number; currentValue?: number
    unit?: string; dueDate?: string; status?: 'ACTIVE' | 'ACHIEVED' | 'MISSED'
  }
  const goal = await prisma.goal.create({
    data: {
      orgId: org(req),
      title: body.title,
      description: body.description,
      platform: body.platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' | undefined,
      metric: body.metric ?? 'followers',
      targetValue: body.targetValue ?? 0,
      currentValue: body.currentValue ?? 0,
      unit: body.unit ?? '',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: body.status ?? 'ACTIVE',
    },
  })
  res.status(201).json({ data: { goal } })
}

export async function updateGoal(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const { id: _id, orgId: _orgId, createdAt: _ca, updatedAt: _ua, org: _org, ...safeBody } = req.body as Record<string, unknown>
  const goal = await prisma.goal.updateMany({
    where: { id, orgId: org(req) },
    data: {
      ...safeBody,
      ...(safeBody['dueDate'] ? { dueDate: new Date(safeBody['dueDate'] as string) } : {}),
      ...(safeBody['targetValue'] != null ? { targetValue: Number(safeBody['targetValue']) } : {}),
      ...(safeBody['currentValue'] != null ? { currentValue: Number(safeBody['currentValue']) } : {}),
    },
  })
  if (!goal.count) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { updated: true } })
}

export async function deleteGoal(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  await prisma.goal.deleteMany({ where: { id, orgId: org(req) } })
  res.json({ data: { deleted: true } })
}

// ── Personas ──────────────────────────────────────────────────

export async function listPersonas(req: AuthRequest, res: Response): Promise<void> {
  const personas = await prisma.persona.findMany({ where: { orgId: org(req) }, orderBy: { createdAt: 'desc' } })
  res.json({ data: { personas } })
}

export async function createPersona(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as {
    name: string; ageRange?: string; gender?: string; location?: string
    interests?: string[]; platforms?: string[]; painPoints?: string[]
    contentPreference?: string; aiGenerated?: boolean
  }
  const persona = await prisma.persona.create({
    data: {
      orgId: org(req),
      name: body.name,
      ageRange: body.ageRange,
      gender: body.gender,
      location: body.location,
      interests: body.interests ?? [],
      platforms: (body.platforms ?? []) as ('INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE')[],
      painPoints: body.painPoints ?? [],
      contentPreference: body.contentPreference,
      aiGenerated: body.aiGenerated ?? false,
    },
  })
  res.status(201).json({ data: { persona } })
}

export async function updatePersona(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const result = await prisma.persona.updateMany({ where: { id, orgId: org(req) }, data: req.body as Record<string, unknown> })
  if (!result.count) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { updated: true } })
}

export async function deletePersona(req: AuthRequest, res: Response): Promise<void> {
  await prisma.persona.deleteMany({ where: { id: req.params['id'], orgId: org(req) } })
  res.json({ data: { deleted: true } })
}

// ── Brand Voice ───────────────────────────────────────────────

export async function getVoice(req: AuthRequest, res: Response): Promise<void> {
  const voice = await prisma.brandVoice.findUnique({ where: { orgId: org(req) } })
  res.json({ data: { voice } })
}

export async function upsertVoice(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as {
    adjectives?: string[]
    personality?: string
    dos?: string[]
    donts?: string[]
    toneByPlatform?: Prisma.InputJsonValue
    captionGood?: string
    captionBad?: string
    aiGenerated?: boolean
  }
  const data = {
    ...(body.adjectives !== undefined && { adjectives: body.adjectives }),
    ...(body.personality !== undefined && { personality: body.personality }),
    ...(body.dos !== undefined && { dos: body.dos }),
    ...(body.donts !== undefined && { donts: body.donts }),
    ...(body.toneByPlatform !== undefined && { toneByPlatform: body.toneByPlatform }),
    ...(body.captionGood !== undefined && { captionGood: body.captionGood }),
    ...(body.captionBad !== undefined && { captionBad: body.captionBad }),
    ...(body.aiGenerated !== undefined && { aiGenerated: body.aiGenerated }),
  }
  const voice = await prisma.brandVoice.upsert({
    where: { orgId: org(req) },
    update: data,
    create: { orgId: org(req), ...data },
  })
  res.json({ data: { voice } })
}

// ── Content Pillars ───────────────────────────────────────────

export async function listPillars(req: AuthRequest, res: Response): Promise<void> {
  const pillars = await prisma.contentPillar.findMany({ where: { orgId: org(req) }, orderBy: { createdAt: 'asc' } })
  res.json({ data: { pillars } })
}

export async function createPillar(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as {
    title: string
    description?: string | null
    postingRatio?: number | null
    colorHex?: string | null
    exampleFormats?: string[]
    captionStarters?: string[]
  }
  const pillar = await prisma.contentPillar.create({
    data: {
      orgId: org(req),
      title: body.title,
      description: body.description ?? undefined,
      postingRatio: body.postingRatio ?? 20,
      colorHex: body.colorHex ?? '#4F6EF7',
      exampleFormats: body.exampleFormats ?? [],
      captionStarters: body.captionStarters ?? [],
    },
  })
  res.status(201).json({ data: { pillar } })
}

export async function updatePillar(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const { id: _id, orgId: _orgId, createdAt: _ca, updatedAt: _ua, ...safeBody } = req.body as Record<string, unknown>
  const result = await prisma.contentPillar.updateMany({ where: { id, orgId: org(req) }, data: safeBody })
  if (!result.count) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { updated: true } })
}

export async function deletePillar(req: AuthRequest, res: Response): Promise<void> {
  await prisma.contentPillar.deleteMany({ where: { id: req.params['id'], orgId: org(req) } })
  res.json({ data: { deleted: true } })
}

// ── Playbook ──────────────────────────────────────────────────

function mapPlaybookSection(s: {
  id: string
  sectionType: string
  content: Prisma.JsonValue
  generatedByAI: boolean
  updatedAt: Date
}) {
  const raw = (s.content && typeof s.content === 'object' && !Array.isArray(s.content))
    ? s.content as Record<string, unknown>
    : null
  const text = typeof raw?.['text'] === 'string' ? raw['text'] : null
  return {
    id: s.id,
    sectionType: s.sectionType,
    content: text,
    generatedAt: s.generatedByAI ? s.updatedAt.toISOString() : null,
    updatedAt: s.updatedAt.toISOString(),
  }
}

export async function getPlaybook(req: AuthRequest, res: Response): Promise<void> {
  const orgId = org(req)
  const [sections, goals, personas, pillars, voice, socialAccounts] = await Promise.all([
    prisma.playbookSection.findMany({ where: { orgId } }),
    prisma.goal.findMany({ where: { orgId, status: 'ACTIVE' } }),
    prisma.persona.findMany({ where: { orgId } }),
    prisma.contentPillar.findMany({ where: { orgId } }),
    prisma.brandVoice.findUnique({ where: { orgId } }),
    prisma.socialAccount.findMany({ where: { orgId }, select: { platform: true, handle: true } }),
  ])
  res.json({ data: { sections: sections.map(mapPlaybookSection), goals, personas, pillars, voice, socialAccounts } })
}

export async function updatePlaybookSection(req: AuthRequest, res: Response): Promise<void> {
  const { sectionType } = req.params
  const orgId = org(req)
  const { content } = req.body as { content: string }
  const jsonContent = { text: content } as unknown as Prisma.InputJsonValue
  const section = await prisma.playbookSection.upsert({
    where: { orgId_sectionType: { orgId, sectionType: sectionType as 'BRAND_VOICE' | 'STRATEGY' | 'POSTING_GUIDE' | 'OUTREACH' } },
    update: { content: jsonContent, generatedByAI: false },
    create: {
      orgId,
      sectionType: sectionType as 'BRAND_VOICE' | 'STRATEGY' | 'POSTING_GUIDE' | 'OUTREACH',
      content: jsonContent,
      generatedByAI: false,
    },
  })
  res.json({ data: { section: mapPlaybookSection(section) } })
}
