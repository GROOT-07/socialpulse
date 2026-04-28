import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  getOverviewMetrics,
  getPlatformMetrics,
  getKpiMetrics,
} from '../controllers/metrics.controller'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

router.get('/kpis', wrapAuth(getKpiMetrics))
router.get('/overview', wrapAuth(getOverviewMetrics))
router.get('/:platform', wrapAuth(getPlatformMetrics))

export default router
