import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { generateContentIdeas } from '../services/ai/aiService'

function org(req: AuthRequest): string { return (req.headers['x-org-id'] as string) || '' }

export async function listIdeas(req: AuthRequest, res: Response): Promise<void> {
  const { platform, status, pillarId } = req.query as Record<string, string>
  const ideas = await prisma.idea.findMany({
    where: {
      orgId: org(req),
      ...(platform ? { platform: platform.toUpperCase() as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' } : {}),
      ...(status ? { status: status.toUpperCase() as 'BACKLOG' | 'SCHEDULED' | 'DONE' } : {}),
      ...(pillarId ? { pillarId } : {}),
    },
    include: { pillar: { select: { title: true, colorHex: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ data: { ideas } })
}

export async function createIdea(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as {
    title: string; description?: string; platform?: string
    pillarId?: string; captionStarter?: string; status?: 'BACKLOG' | 'SCHEDULED' | 'DONE'
  }
  const idea = await prisma.idea.create({
    data: {
      orgId: org(req),
      title: body.title,
      description: body.description,
      platform: body.platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' | undefined,
      pillarId: body.pillarId,
      captionStarter: body.captionStarter,
      status: body.status ?? 'BACKLOG',
    },
  })
  res.status(201).json({ data: { idea } })
}

export async function updateIdea(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const { id: _id, orgId: _orgId, createdAt: _ca, updatedAt: _ua, ...safeBody } = req.body as Record<string, unknown>
  const result = await prisma.idea.updateMany({ where: { id, orgId: org(req) }, data: safeBody })
  if (!result.count) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { updated: true } })
}

export async function deleteIdea(req: AuthRequest, res: Response): Promise<void> {
  await prisma.idea.deleteMany({ where: { id: req.params['id'], orgId: org(req) } })
  res.json({ data: { deleted: true } })
}

export async function generateIdeasHandler(req: AuthRequest, res: Response): Promise<void> {
  const orgId = org(req)
  const generated = await generateContentIdeas(orgId, 5)
  const saved = await Promise.all(
    generated.map((ai) =>
      prisma.idea.create({
        data: {
          orgId,
          title: ai.title ?? 'Untitled',
          description: ai.description ?? null,
          platform: ai.platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' | undefined ?? null,
          pillarId: ai.pillarId ?? null,
          captionStarter: ai.captionStarter ?? null,
          aiGenerated: true,
        },
      }),
    ),
  )
  res.json({ data: { ideas: saved } })
}
