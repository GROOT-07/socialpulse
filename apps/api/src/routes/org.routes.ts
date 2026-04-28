import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { authenticate } from '../middleware/auth'
import { wrapAuth } from '../lib/asyncHandler'
import { listOrgs, getOrg, createOrg, updateOrg, deleteOrg, switchOrg } from '../controllers/org.controller'

const router: ReturnType<typeof Router> = Router()

const platformValues = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WHATSAPP', 'GOOGLE'] as const

const createOrgSchema = z.object({
  name: z.string().min(2).max(80),
  industry: z.string().min(1),
  city: z.string().optional(),
  country: z.string().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
})

const updateOrgSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  industry: z.string().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  logoUrl: z.string().url().optional(),
  activePlatforms: z.array(z.enum(platformValues)).optional(),
  timezone: z.string().optional(),
})

router.use(authenticate)

router.get('/', wrapAuth(listOrgs))
router.post('/', validate(createOrgSchema), wrapAuth(createOrg))
router.get('/:id', wrapAuth(getOrg))
router.patch('/:id', validate(updateOrgSchema), wrapAuth(updateOrg))
router.delete('/:id', wrapAuth(deleteOrg))
router.post('/:id/switch', wrapAuth(switchOrg))

export default router
