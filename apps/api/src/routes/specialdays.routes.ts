import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import type { Request, Response } from 'express'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

// GET /api/special-days/upcoming?days=30
// Returns upcoming special days within the next N days
router.get('/upcoming', async (req: Request, res: Response) => {
  const days = Math.min(Number(req.query['days'] ?? 30), 365)
  const country = (req.query['country'] as string) ?? undefined
  const industry = (req.query['industry'] as string) ?? undefined

  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date()
  to.setDate(to.getDate() + days)
  to.setHours(23, 59, 59, 999)

  const days30 = await prisma.specialDay.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(country ? { countries: { has: country } } : {}),
      ...(industry ? { industries: { has: industry } } : {}),
    },
    orderBy: { date: 'asc' },
    take: 50,
  })

  res.json(days30)
})

// GET /api/special-days?month=4&year=2026
// Returns special days for a specific month (for Smart Calendar)
router.get('/', async (req: Request, res: Response) => {
  const month = Number(req.query['month'] ?? new Date().getMonth() + 1)
  const year = Number(req.query['year'] ?? new Date().getFullYear())

  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 0, 23, 59, 59)

  const specialDays = await prisma.specialDay.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  })

  res.json(specialDays)
})

export default router
