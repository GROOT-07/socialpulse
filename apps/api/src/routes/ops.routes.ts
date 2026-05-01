/**
 * OPS (Online Presence Score) Routes
 * GET  /api/ops        — get stored OPS for org
 * POST /api/ops/recalc — force recalculate OPS
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import { calculateOPS, getOPS } from '../services/scoring/presenceScoreService'
import type { AuthRequest } from '../middleware/auth'
import type { Response } from 'express'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

function orgId(req: AuthRequest): string | null {
  return (req.headers['x-org-id'] as string) || null
}

// GET /api/ops — return stored breakdown (or calculate if missing)
router.get('/', wrapAuth(async (req: AuthRequest, res: Response) => {
  const id = orgId(req)
  if (!id) { res.status(400).json({ error: 'x-org-id required' }); return }

  let ops = await getOPS(id)
  if (!ops) {
    // Calculate on demand if nothing stored
    ops = await calculateOPS(id)
  }

  res.json({ data: { ops } })
}))

// POST /api/ops/recalc — force recalculate
router.post('/recalc', wrapAuth(async (req: AuthRequest, res: Response) => {
  const id = orgId(req)
  if (!id) { res.status(400).json({ error: 'x-org-id required' }); return }

  const ops = await calculateOPS(id)
  res.json({ data: { ops } })
}))

export default router
