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
  rediscoverCompetitors,
  updateCompetitorStatus,
  getDiscoveryMeta,
} from '../controllers/competitor.controller'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

router.get('/', wrapAuth(listCompetitors))
router.post('/', wrapAuth(addCompetitor))
// Discovery meta & rediscover (must come before /:id routes)
router.get('/meta/discovery', wrapAuth(getDiscoveryMeta))
router.post('/rediscover', wrapAuth(rediscoverCompetitors))
router.get('/:id', wrapAuth(getCompetitor))
router.patch('/:id', wrapAuth(updateCompetitor))
router.patch('/:id/status', wrapAuth(updateCompetitorStatus))
router.delete('/:id', wrapAuth(removeCompetitor))
router.post('/:id/sync', wrapAuth(triggerCompetitorSync))
router.get('/:id/posts', wrapAuth(getCompetitorPosts))

export default router
