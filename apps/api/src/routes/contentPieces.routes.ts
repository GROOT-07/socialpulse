import { Router, type Response } from 'express'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../lib/asyncHandler'
import { prisma } from '../lib/prisma'

const router = Router()

const wrap = (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  asyncHandler(fn as Parameters<typeof asyncHandler>[0])

router.use(authenticate)

router.get('/', wrap(async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.activeOrgId
  if (!orgId) { res.status(400).json({ error: 'No active org' }); return }

  const { type } = req.query as { type?: string }

  const pieces = await prisma.contentPiece.findMany({
    where: {
      orgId,
      status: { not: 'ARCHIVED' },
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  res.json({ data: pieces })
}))

router.delete('/:id', wrap(async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  await prisma.contentPiece.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  })
  res.json({ data: { success: true } })
}))

export default router
