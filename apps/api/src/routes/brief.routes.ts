import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  getTodayBrief,
  triggerBriefGeneration,
} from '../controllers/brief.controller'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

router.get('/today', wrapAuth(getTodayBrief))
router.post('/generate', wrapAuth(triggerBriefGeneration))

export default router
