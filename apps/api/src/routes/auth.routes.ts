import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { authenticate } from '../middleware/auth'
import { wrap, wrapAuth } from '../lib/asyncHandler'
import {
  register,
  login,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
  getMe,
} from '../controllers/auth.controller'

const router = Router()

// ── Validation schemas ────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgName: z.string().min(2, 'Organization name must be at least 2 characters').max(80),
  industry: z.string().min(1, 'Industry is required'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

const forgotSchema = z.object({
  email: z.string().email(),
})

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

// ── Routes ────────────────────────────────────────────────────

router.post('/register', validate(registerSchema), wrap(register))
router.post('/login', validate(loginSchema), wrap(login))
router.post('/logout', wrap(logout))
router.post('/refresh', validate(refreshSchema), wrap(refresh))
router.post('/forgot-password', validate(forgotSchema), wrap(forgotPassword))
router.post('/reset-password', validate(resetSchema), wrap(resetPassword))
router.get('/me', authenticate, wrapAuth(getMe))

export default router
