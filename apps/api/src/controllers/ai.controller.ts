import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import {
  generateGapAnalysis,
  generateContentIdeas,
  generatePlaybookSection,
  generatePersona,
  generateBrandVoice,
} from '../services/ai/aiService'

function getOrg(req: AuthRequest): string | null {
  return (req.headers['x-org-id'] as string) || null
}

export async function gapAnalysis(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrg(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const result = await generateGapAnalysis(orgId)
  res.json({ data: { gapAnalysis: result } })
}

export async function generateIdeas(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrg(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const { count = 5 } = req.body as { count?: number }
  const ideas = await generateContentIdeas(orgId, count)
  res.json({ data: { ideas } })
}

export async function generateSection(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrg(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const { sectionType } = req.body as { sectionType: string }
  if (!sectionType) { res.status(400).json({ error: 'sectionType required in body' }); return }
  const text = await generatePlaybookSection(orgId, sectionType.toUpperCase())
  res.json({ data: { section: { content: text } } })
}

export async function generatePersonaHandler(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrg(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const body = req.body as { demographics?: string; description?: string; ageRange?: string; gender?: string; location?: string }
  const description = body.demographics ?? body.description ?? undefined
  const demographics = description
    ? { location: description }
    : { ageRange: body.ageRange, gender: body.gender, location: body.location }
  const persona = await generatePersona(orgId, demographics)
  res.json({ data: { persona } })
}

export async function generateVoiceHandler(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrg(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }
  const voice = await generateBrandVoice(orgId)
  res.json({ data: { voice } })
}
