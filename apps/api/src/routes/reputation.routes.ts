/**
 * Reputation Routes
 * GET  /api/reputation        — get stored reputation report for org
 * POST /api/reputation/refresh — force refresh reputation data
 * GET  /api/reputation/web    — analyse web presence (mentions, sentiment)
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import { analyseReputation, getReputation } from '../services/reputation/reputationService'
import { analyseWebPresence } from '../services/web/webIntelligenceService'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from '../middleware/auth'
import type { Response } from 'express'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

function orgId(req: AuthRequest): string | null {
  return (req.headers['x-org-id'] as string) || null
}

// GET /api/reputation — get stored or auto-generate
router.get('/', wrapAuth(async (req: AuthRequest, res: Response) => {
  const id = orgId(req)
  if (!id) { res.status(400).json({ error: 'x-org-id required' }); return }

  let report = await getReputation(id)
  if (!report) {
    report = await analyseReputation(id)
  }

  res.json({ data: { reputation: report } })
}))

// POST /api/reputation/refresh — force re-analyse
router.post('/refresh', wrapAuth(async (req: AuthRequest, res: Response) => {
  const id = orgId(req)
  if (!id) { res.status(400).json({ error: 'x-org-id required' }); return }

  const report = await analyseReputation(id)
  res.json({ data: { reputation: report } })
}))

// GET /api/reputation/web — web presence / mentions analysis
router.get('/web', wrapAuth(async (req: AuthRequest, res: Response) => {
  const id = orgId(req)
  if (!id) { res.status(400).json({ error: 'x-org-id required' }); return }

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { name: true, industry: true, city: true, website: true },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }

  const report = await analyseWebPresence(
    org.name,
    org.industry ?? 'Business',
    org.city ?? 'India',
    org.website ?? undefined,
  )

  res.json({ data: { webPresence: report } })
}))

export default router
