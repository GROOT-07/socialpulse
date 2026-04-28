import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  listIdeas,
  createIdea,
  updateIdea,
  deleteIdea,
  generateIdeasHandler,
} from '../controllers/ideas.controller'

const router = Router()
router.use(authenticate)

router.get('/', wrapAuth(listIdeas))
router.post('/', wrapAuth(createIdea))
router.patch('/:id', wrapAuth(updateIdea))
router.delete('/:id', wrapAuth(deleteIdea))
router.post('/generate', wrapAuth(generateIdeasHandler))

export default router
