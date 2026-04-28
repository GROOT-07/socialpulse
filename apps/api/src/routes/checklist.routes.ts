import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  getChecklist,
  toggleChecklistItem,
  addCustomItem,
  resetChecklist,
} from '../controllers/checklist.controller'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

router.get('/', wrapAuth(getChecklist))
router.patch('/:id/toggle', wrapAuth(toggleChecklistItem))
router.post('/', wrapAuth(addCustomItem))
router.post('/reset', wrapAuth(resetChecklist))

export default router
