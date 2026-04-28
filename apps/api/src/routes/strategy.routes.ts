import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  listGoals, createGoal, updateGoal, deleteGoal,
  listPersonas, createPersona, updatePersona, deletePersona,
  getVoice, upsertVoice,
  listPillars, createPillar, updatePillar, deletePillar,
  getPlaybook, updatePlaybookSection,
} from '../controllers/strategy.controller'

const router = Router()
router.use(authenticate)

// Goals
router.get('/goals', wrapAuth(listGoals))
router.post('/goals', wrapAuth(createGoal))
router.patch('/goals/:id', wrapAuth(updateGoal))
router.delete('/goals/:id', wrapAuth(deleteGoal))

// Personas
router.get('/personas', wrapAuth(listPersonas))
router.post('/personas', wrapAuth(createPersona))
router.patch('/personas/:id', wrapAuth(updatePersona))
router.delete('/personas/:id', wrapAuth(deletePersona))

// Brand Voice
router.get('/voice', wrapAuth(getVoice))
router.put('/voice', wrapAuth(upsertVoice))

// Content Pillars
router.get('/pillars', wrapAuth(listPillars))
router.post('/pillars', wrapAuth(createPillar))
router.patch('/pillars/:id', wrapAuth(updatePillar))
router.delete('/pillars/:id', wrapAuth(deletePillar))

// Playbook
router.get('/playbook', wrapAuth(getPlaybook))
router.patch('/playbook/:sectionType', wrapAuth(updatePlaybookSection))

export default router
