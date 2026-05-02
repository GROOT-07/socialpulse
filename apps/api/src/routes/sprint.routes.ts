import { Router, type Response } from 'express'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  handleGenerateSprint,
  handleRegenerateWeek,
  handleGetSprint,
  handleListSprints,
  handleGetGuardrails,
  handleGenerateGuardrails,
  handleUpdateGuardrail,
  handleDeleteGuardrail,
  handleCreateGuardrail,
} from '../controllers/sprint.controller'

const router = Router()

router.use(authenticate)

// Sprint routes
router.get('/latest', wrapAuth(handleGetSprint))
router.get('/', wrapAuth(handleListSprints))
router.post('/generate', wrapAuth(handleGenerateSprint))
router.post('/regenerate-week', wrapAuth(handleRegenerateWeek))

// Guardrail routes
router.get('/guardrails', wrapAuth(handleGetGuardrails))
router.post('/guardrails/generate', wrapAuth(handleGenerateGuardrails))
router.post('/guardrails', wrapAuth(handleCreateGuardrail))
router.patch('/guardrails/:id', wrapAuth(handleUpdateGuardrail))
router.delete('/guardrails/:id', wrapAuth(handleDeleteGuardrail))

export default router
