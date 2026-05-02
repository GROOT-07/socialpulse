import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import {
  generateSprintPlan,
  regenerateSprintWeek,
  getLatestSprint,
  listSprints,
  generateGuardrails,
} from '../services/sprint/sprintService'
import { prisma } from '../lib/prisma'

export async function handleGenerateSprint(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const { startDate } = req.body as { startDate?: string }
  const start = startDate ? new Date(startDate) : new Date()
  start.setHours(0, 0, 0, 0)

  const sprintId = await generateSprintPlan(orgId, start)
  const sprint = await getLatestSprint(orgId)
  res.status(201).json({ data: sprint, sprintId })
}

export async function handleRegenerateWeek(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const { sprintId, weekNumber } = req.body as { sprintId: string; weekNumber: number }
  const result = await regenerateSprintWeek(orgId, sprintId, weekNumber)
  res.json({ data: { text: result } })
}

export async function handleGetSprint(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const sprint = await getLatestSprint(orgId)
  res.json({ data: sprint })
}

export async function handleListSprints(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const sprints = await listSprints(orgId)
  res.json({ data: sprints })
}

export async function handleGetGuardrails(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const guardrails = await prisma.contentGuardrail.findMany({
    where: { orgId },
    orderBy: [{ category: 'asc' }, { ruleType: 'asc' }],
  })
  res.json({ data: guardrails })
}

export async function handleGenerateGuardrails(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  await generateGuardrails(orgId)
  const guardrails = await prisma.contentGuardrail.findMany({
    where: { orgId },
    orderBy: [{ category: 'asc' }, { ruleType: 'asc' }],
  })
  res.json({ data: guardrails })
}

export async function handleUpdateGuardrail(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const { text, category, ruleType, platform } = req.body as {
    text?: string; category?: string; ruleType?: string; platform?: string | null
  }

  const updated = await prisma.contentGuardrail.update({
    where: { id },
    data: { text, category, ruleType, platform },
  })
  res.json({ data: updated })
}

export async function handleDeleteGuardrail(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  await prisma.contentGuardrail.delete({ where: { id } })
  res.json({ data: { success: true } })
}

export async function handleCreateGuardrail(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const { text, category, ruleType, platform } = req.body as {
    text: string; category: string; ruleType: string; platform?: string | null
  }

  const created = await prisma.contentGuardrail.create({
    data: { orgId, text, category, ruleType, platform: platform ?? null, aiGenerated: false },
  })
  res.status(201).json({ data: created })
}
