import type { Response } from 'express'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from '../middleware/auth'
import type { Platform } from '@socialpulse/shared'

// ── List user's orgs ──────────────────────────────────────────

export async function listOrgs(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.sub

  const memberships = await prisma.orgMember.findMany({
    where: { userId, acceptedAt: { not: null } },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          brandColor: true,
          industry: true,
          city: true,
          country: true,
          activePlatforms: true,
          ownerId: true,
          createdAt: true,
        },
      },
    },
  })

  res.json({ data: memberships.map((m) => ({ ...m.org, role: m.role })) })
}

// ── Get single org ────────────────────────────────────────────

export async function getOrg(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.sub

  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: id, userId } },
    include: {
      org: true,
    },
  })

  if (!member) {
    res.status(404).json({ error: 'Not found', message: 'Organization not found' })
    return
  }

  res.json({ data: { ...member.org, role: member.role } })
}

// ── Create org ────────────────────────────────────────────────

export async function createOrg(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.sub
  const { name, industry, city, country, brandColor } = req.body as {
    name: string
    industry: string
    city?: string
    country?: string
    brandColor?: string
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const existing = await prisma.organization.findUnique({ where: { slug } })
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug

  const org = await prisma.organization.create({
    data: {
      name,
      slug: finalSlug,
      industry,
      city,
      country,
      brandColor,
      ownerId: userId,
      activePlatforms: [],
      members: {
        create: { userId, role: 'ORG_ADMIN', acceptedAt: new Date() },
      },
    },
  })

  res.status(201).json({ data: org })
}

// ── Update org ────────────────────────────────────────────────

export async function updateOrg(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.sub

  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: id, userId } },
  })

  if (!member || !['ORG_ADMIN', 'SUPER_ADMIN'].includes(member.role)) {
    res.status(403).json({ error: 'Forbidden', message: 'Admin access required' })
    return
  }

  const { name, industry, city, country, brandColor, logoUrl, activePlatforms, timezone } =
    req.body as {
      name?: string
      industry?: string
      city?: string
      country?: string
      brandColor?: string
      logoUrl?: string
      activePlatforms?: Platform[]
      timezone?: string
    }

  const org = await prisma.organization.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(industry && { industry }),
      ...(city !== undefined && { city }),
      ...(country !== undefined && { country }),
      ...(brandColor && { brandColor }),
      ...(logoUrl && { logoUrl }),
      ...(activePlatforms && { activePlatforms }),
      ...(timezone && { timezone }),
    },
  })

  res.json({ data: org })
}

// ── Delete org ────────────────────────────────────────────────

export async function deleteOrg(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.sub

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) {
    res.status(404).json({ error: 'Not found', message: 'Organization not found' })
    return
  }

  if (org.ownerId !== userId && req.user!.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden', message: 'Only the owner can delete this org' })
    return
  }

  await prisma.organization.delete({ where: { id } })
  res.json({ data: { message: 'Organization deleted' } })
}

// ── Switch active org ─────────────────────────────────────────

export async function switchOrg(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.sub

  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: id, userId } },
    include: { org: true },
  })

  if (!member) {
    res.status(404).json({ error: 'Not found', message: 'You are not a member of this organization' })
    return
  }

  await prisma.user.update({ where: { id: userId }, data: { activeOrgId: id } })

  res.json({ data: { activeOrg: member.org } })
}
