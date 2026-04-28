import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { wrap, wrapAuth } from '../lib/asyncHandler'
import {
  getConnectedAccounts,
  disconnectAccount,
  triggerSync,
  instagramConnect,
  instagramCallback,
  facebookConnect,
  facebookCallback,
  youtubeConnect,
  youtubeCallback,
} from '../controllers/social.controller'

const router: ReturnType<typeof Router> = Router()

// ── OAuth connect initiation (returns redirect URL) ───────────
router.get('/auth/instagram/connect', authenticate, wrapAuth(instagramConnect))
router.get('/auth/facebook/connect', authenticate, wrapAuth(facebookConnect))
router.get('/auth/youtube/connect', authenticate, wrapAuth(youtubeConnect))

// ── OAuth callbacks (called by Meta / Google) ─────────────────
router.get('/auth/instagram/callback', wrap(instagramCallback))
router.get('/auth/facebook/callback', wrap(facebookCallback))
router.get('/auth/youtube/callback', wrap(youtubeCallback))

// ── Account management ────────────────────────────────────────
router.get('/accounts', authenticate, wrapAuth(getConnectedAccounts))
router.delete('/accounts/:id', authenticate, wrapAuth(disconnectAccount))
router.post('/accounts/:id/sync', authenticate, wrapAuth(triggerSync))

export default router
