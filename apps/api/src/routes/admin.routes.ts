import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  listOrgs,
  listUsers,
  getJobQueues,
  getApiHealth,
  resetOrgData,
} from '../controllers/admin.controller'

const router = Router()
router.use(authenticate)

router.get('/orgs', wrapAuth(listOrgs))
router.get('/users', wrapAuth(listUsers))
router.get('/queues', wrapAuth(getJobQueues))
router.get('/health', wrapAuth(getApiHealth))
router.post('/orgs/:orgId/reset', wrapAuth(resetOrgData))

export default router
