import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  listCalendar,
  createCalendarPost,
  updateCalendarPost,
  deleteCalendarPost,
} from '../controllers/calendar.controller'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

router.get('/', wrapAuth(listCalendar))
router.post('/', wrapAuth(createCalendarPost))
router.patch('/:id', wrapAuth(updateCalendarPost))
router.delete('/:id', wrapAuth(deleteCalendarPost))

export default router
