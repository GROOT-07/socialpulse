import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  getAudit,
  toggleAuditItem,
} from '../controllers/audit.controller'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

router.get('/', wrapAuth(getAudit))
router.patch('/:id/toggle', wrapAuth(toggleAuditItem))

export default router
