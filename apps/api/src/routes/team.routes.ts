import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import {
  // review
  listReviewQueue,
  reviewContentPiece,
  // notes
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  enhanceNote,
  // meetings
  analyzeMeeting,
  listMeetings,
  getMeeting,
  deleteMeeting,
} from '../controllers/team.controller'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)

// ── Content review ──────────────────────────────────────────────
router.get('/review', wrapAuth(listReviewQueue))
router.patch(
  '/review/:id',
  validate(z.object({ action: z.enum(['approve', 'reject']) })),
  wrapAuth(reviewContentPiece),
)

// ── Team notes ──────────────────────────────────────────────────
router.get('/notes', wrapAuth(listNotes))
router.post(
  '/notes',
  validate(z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(50_000),
  })),
  wrapAuth(createNote),
)
router.patch(
  '/notes/:id',
  validate(z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(50_000).optional(),
  })),
  wrapAuth(updateNote),
)
router.delete('/notes/:id', wrapAuth(deleteNote))
router.post('/notes/:id/enhance', wrapAuth(enhanceNote))

// ── Meeting intelligence ────────────────────────────────────────
router.get('/meetings', wrapAuth(listMeetings))
router.post(
  '/meetings/analyze',
  validate(z.object({
    title: z.string().max(200).optional(),
    transcript: z.string().min(50).max(50_000),
    participants: z.string().max(500).optional(),
    duration: z.string().max(50).optional(),
  })),
  wrapAuth(analyzeMeeting),
)
router.get('/meetings/:id', wrapAuth(getMeeting))
router.delete('/meetings/:id', wrapAuth(deleteMeeting))

export default router
