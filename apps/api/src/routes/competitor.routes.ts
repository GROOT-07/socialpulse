import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  listCompetitors,
  getCompetitor,
  addCompetitor,
  updateCompetitor,
  removeCompetitor,
  triggerCompetitorSync,
  getCompetitorPosts,
} from '../controllers/competitor.controller'

const router = Router()
router.use(authenticate)

router.get('/', wrapAuth(listCompetitors))
router.post('/', wrapAuth(addCompetitor))
router.get('/:id', wrapAuth(getCompetitor))
router.patch('/:id', wrapAuth(updateCompetitor))
router.delete('/:id', wrapAuth(removeCompetitor))
router.post('/:id/sync', wrapAuth(triggerCompetitorSync))
router.get('/:id/posts', wrapAuth(getCompetitorPosts))

export default router
