import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

function org(req: AuthRequest): string { return (req.headers['x-org-id'] as string) || '' }

export async function getOrgSettings(req: AuthRequest, res: Response): Promise<void> {
  const orgData = await prisma.organization.findUnique({
    where: { id: org(req) },
    select: { id: true, name: true, slug: true, industry: true, brandColor: true, city: true, country: true, timezone: true, logoUrl: true, activePlatforms: true, createdAt: true },
  })
  if (!orgData) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { org: orgData } })
}

export async function updateOrgSettings(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as { name?: string; industry?: string; brandColor?: string; city?: string; country?: string; timezone?: string; activePlatforms?: string[] }
  // Strip any unknown fields that might cause Prisma to throw
  const allowed = ['name', 'industry', 'brandColor', 'city', 'country', 'timezone', 'activePlatforms'] as const
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key]
  }
  const updated = await prisma.organization.update({ where: { id: org(req) }, data })
  res.json({ data: { org: updated } })
}

export async function listTeamMembers(req: AuthRequest, res: Response): Promise<void> {
  const members = await prisma.orgMember.findMany({
    where: { orgId: org(req) },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { invitedAt: 'asc' },
  })
  // Map to stable frontend shape
  const mapped = members.map(m => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    joinedAt: (m.acceptedAt ?? m.invitedAt).toISOString(),
    user: { id: m.user.id, email: m.user.email },
  }))
  res.json({ data: { members: mapped } })
}

export async function updateMemberRole(req: AuthRequest, res: Response): Promise<void> {
  const { userId } = req.params
  const { role } = req.body as { role: string }
  const member = await prisma.orgMember.findFirst({ where: { userId, orgId: org(req) } })
  if (!member) { res.status(404).json({ error: 'Member not found' }); return }
  await prisma.orgMember.update({ where: { id: member.id }, data: { role: role as 'ORG_ADMIN' | 'VIEWER' } })
  res.json({ data: { updated: true } })
}

export async function removeMember(req: AuthRequest, res: Response): Promise<void> {
  const { userId } = req.params
  await prisma.orgMember.deleteMany({ where: { userId, orgId: org(req) } })
  res.json({ data: { removed: true } })
}
