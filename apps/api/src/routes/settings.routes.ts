import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  getOrgSettings,
  updateOrgSettings,
  listTeamMembers,
  updateMemberRole,
  removeMember,
  inviteTeamMember,
} from '../controllers/settings.controller'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

router.get('/', wrapAuth(getOrgSettings))
router.patch('/', wrapAuth(updateOrgSettings))
router.get('/team', wrapAuth(listTeamMembers))
router.post('/team/invite', wrapAuth(inviteTeamMember))
router.patch('/team/:userId/role', wrapAuth(updateMemberRole))
router.delete('/team/:userId', wrapAuth(removeMember))

export default router
