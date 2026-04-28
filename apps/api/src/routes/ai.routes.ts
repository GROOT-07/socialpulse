import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  gapAnalysis,
  generateIdeas,
  generateSection,
  generatePersonaHandler,
  generateVoiceHandler,
} from '../controllers/ai.controller'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

router.get('/gap-analysis', wrapAuth(gapAnalysis))
router.post('/ideas', wrapAuth(generateIdeas))
router.post('/playbook-section', wrapAuth(generateSection))
router.post('/persona', wrapAuth(generatePersonaHandler))
router.post('/brand-voice', wrapAuth(generateVoiceHandler))

export default router
