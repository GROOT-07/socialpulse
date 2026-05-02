/**
 * Team Collaboration Hub Controller
 *
 * Provides endpoints for:
 *  1. Content Review — review/approve/reject AI-drafted ContentPieces
 *  2. Team Notes     — lightweight rich notes with AI enhance
 *  3. Meeting Intelligence — analyze transcripts with Gemini, store as ContentPiece
 *
 * All data uses existing DB models (no schema changes):
 *  • ContentPiece — notes (type=FAQ), meeting summaries (type=BLOG), review queue
 *  • Status flow: DRAFT (pending review) → SCHEDULED (approved) → ARCHIVED (rejected)
 */

import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { ask, askJSON } from '../lib/ai/gemini'
import {
  ContentPieceStatus,
  ContentPieceType,
} from '@prisma/client'

function getOrgId(req: AuthRequest): string | null {
  return (req.headers['x-org-id'] as string) || null
}

// ─────────────────────────────────────────────────────
// CONTENT REVIEW
// ─────────────────────────────────────────────────────

/** GET /api/team/review — list AI-drafted content pending review */
export async function listReviewQueue(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const items = await prisma.contentPiece.findMany({
    where: { orgId, generatedByAI: true, status: ContentPieceStatus.DRAFT },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  res.json(items)
}

/** PATCH /api/team/review/:id — approve or reject a content piece */
export async function reviewContentPiece(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const { id } = req.params as { id: string }
  const { action } = req.body as { action: 'approve' | 'reject' }

  if (!['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'action must be "approve" or "reject"' })
    return
  }

  const piece = await prisma.contentPiece.findFirst({
    where: { id, orgId },
  })
  if (!piece) { res.status(404).json({ error: 'Content piece not found' }); return }

  const updated = await prisma.contentPiece.update({
    where: { id },
    data: {
      status: action === 'approve'
        ? ContentPieceStatus.SCHEDULED
        : ContentPieceStatus.ARCHIVED,
    },
  })

  res.json(updated)
}

// ─────────────────────────────────────────────────────
// TEAM NOTES
// ─────────────────────────────────────────────────────

const NOTE_TITLE_PREFIX = '[NOTE] '

/** GET /api/team/notes */
export async function listNotes(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const notes = await prisma.contentPiece.findMany({
    where: {
      orgId,
      type: ContentPieceType.FAQ,
      title: { startsWith: NOTE_TITLE_PREFIX },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  // Strip prefix from title for display
  const shaped = notes.map((n) => ({
    ...n,
    title: n.title.replace(NOTE_TITLE_PREFIX, ''),
  }))

  res.json(shaped)
}

/** POST /api/team/notes */
export async function createNote(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const { title, content } = req.body as { title: string; content: string }
  if (!title?.trim() || !content?.trim()) {
    res.status(400).json({ error: 'title and content are required' })
    return
  }

  const note = await prisma.contentPiece.create({
    data: {
      orgId,
      type: ContentPieceType.FAQ,
      title: `${NOTE_TITLE_PREFIX}${title.slice(0, 200)}`,
      content: content.slice(0, 50_000),
      hashtags: [],
      status: ContentPieceStatus.DRAFT,
      generatedByAI: false,
    },
  })

  res.json({ ...note, title: note.title.replace(NOTE_TITLE_PREFIX, '') })
}

/** PATCH /api/team/notes/:id */
export async function updateNote(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const { id } = req.params as { id: string }
  const { title, content } = req.body as { title?: string; content?: string }

  const note = await prisma.contentPiece.findFirst({
    where: { id, orgId, type: ContentPieceType.FAQ },
  })
  if (!note) { res.status(404).json({ error: 'Note not found' }); return }

  const updated = await prisma.contentPiece.update({
    where: { id },
    data: {
      ...(title ? { title: `${NOTE_TITLE_PREFIX}${title.slice(0, 200)}` } : {}),
      ...(content ? { content: content.slice(0, 50_000) } : {}),
    },
  })

  res.json({ ...updated, title: updated.title.replace(NOTE_TITLE_PREFIX, '') })
}

/** DELETE /api/team/notes/:id */
export async function deleteNote(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const { id } = req.params as { id: string }
  const note = await prisma.contentPiece.findFirst({
    where: { id, orgId, type: ContentPieceType.FAQ },
  })
  if (!note) { res.status(404).json({ error: 'Note not found' }); return }

  await prisma.contentPiece.delete({ where: { id } })
  res.json({ success: true })
}

/** POST /api/team/notes/:id/enhance — AI rewrite / improve note */
export async function enhanceNote(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const { id } = req.params as { id: string }
  const note = await prisma.contentPiece.findFirst({
    where: { id, orgId, type: ContentPieceType.FAQ },
  })
  if (!note) { res.status(404).json({ error: 'Note not found' }); return }

  const enhanced = await ask(
    `You are a professional business writer. Improve the following team note — make it clearer, more structured, and more actionable. Preserve all key information. Use plain text with short paragraphs and bullet points where appropriate. Do NOT add a title or heading.

ORIGINAL NOTE:
${note.content}

Return ONLY the improved note text, nothing else.`,
    { model: 'flash', maxTokens: 2048, temperature: 0.5 },
  )

  const updated = await prisma.contentPiece.update({
    where: { id },
    data: { content: enhanced, generatedByAI: true },
  })

  res.json({ ...updated, title: updated.title.replace(NOTE_TITLE_PREFIX, '') })
}

// ─────────────────────────────────────────────────────
// MEETING INTELLIGENCE
// ─────────────────────────────────────────────────────

const MEETING_TITLE_PREFIX = '[MEETING] '

interface MeetingAnalysis {
  meetingTitle: string
  date: string
  duration: string
  participants: string[]
  executiveSummary: string
  keyDecisions: string[]
  actionItems: Array<{
    task: string
    owner: string
    deadline: string
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  contentIdeas: Array<{
    title: string
    platform: string
    format: string
    hook: string
  }>
  followUpQuestions: string[]
  nextMeetingAgenda: string[]
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'MIXED' | 'NEGATIVE'
  tags: string[]
}

/** POST /api/team/meetings/analyze */
export async function analyzeMeeting(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const { title, transcript, participants, duration } = req.body as {
    title: string
    transcript: string
    participants?: string
    duration?: string
  }

  if (!transcript?.trim()) {
    res.status(400).json({ error: 'transcript is required' })
    return
  }

  const meetingTitle = title?.trim() || 'Team Meeting'

  // Load org context
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, industry: true, city: true },
  })

  const analysis = await askJSON<MeetingAnalysis>(
    `You are an expert meeting intelligence analyst for ${org?.name ?? 'a social media agency'} — a ${org?.industry ?? 'marketing'} business in ${org?.city ?? 'India'}.

Analyze the following meeting transcript and produce a comprehensive meeting intelligence report.

MEETING TITLE: ${meetingTitle}
${duration ? `DURATION: ${duration}` : ''}
${participants ? `PARTICIPANTS: ${participants}` : ''}

TRANSCRIPT:
${transcript.slice(0, 12_000)}

Return a single JSON object with this EXACT structure:
{
  "meetingTitle": "${meetingTitle}",
  "date": "${new Date().toISOString().split('T')[0]}",
  "duration": "${duration ?? 'Not specified'}",
  "participants": [${participants ? participants.split(',').map((p) => `"${p.trim()}"`).join(', ') : '"Team"'}],
  "executiveSummary": "2-3 sentence summary of what was discussed and decided",
  "keyDecisions": ["Decision 1", "Decision 2", "Decision 3"],
  "actionItems": [
    {"task": "Specific action", "owner": "Person name or Team", "deadline": "By [date/timeframe]", "priority": "HIGH"},
    {"task": "Another action", "owner": "Person", "deadline": "By [timeframe]", "priority": "MEDIUM"}
  ],
  "contentIdeas": [
    {"title": "Post idea from meeting insights", "platform": "INSTAGRAM", "format": "REEL", "hook": "Opening hook for the post"},
    {"title": "Another content idea", "platform": "FACEBOOK", "format": "POST", "hook": "Hook line"}
  ],
  "followUpQuestions": ["Question needing follow-up 1", "Question 2"],
  "nextMeetingAgenda": ["Agenda point 1", "Agenda point 2", "Agenda point 3"],
  "sentiment": "POSITIVE",
  "tags": ["relevant", "topic", "tags"]
}

Rules:
- Extract ALL action items — be specific about tasks, owners, and deadlines
- Generate 3-5 content ideas that could come from insights shared in this meeting
- Tags should be 3-8 relevant keywords from the discussion
- sentiment: POSITIVE (productive/enthusiastic), NEUTRAL (standard), MIXED (some tension), NEGATIVE (problematic)
- Return ONLY valid JSON`,
    { model: 'pro', maxTokens: 4096, temperature: 0.3 },
  )

  // Store as ContentPiece (type=BLOG, status=DRAFT)
  const saved = await prisma.contentPiece.create({
    data: {
      orgId,
      type: ContentPieceType.BLOG,
      title: `${MEETING_TITLE_PREFIX}${meetingTitle.slice(0, 180)}`,
      content: JSON.stringify({ ...analysis, originalTranscript: transcript.slice(0, 5_000) }),
      hashtags: analysis.tags ?? [],
      status: ContentPieceStatus.DRAFT,
      generatedByAI: true,
    },
  })

  res.json({
    id: saved.id,
    title: meetingTitle,
    analysis,
    savedAt: saved.createdAt,
  })
}

/** GET /api/team/meetings — list stored meeting summaries */
export async function listMeetings(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const pieces = await prisma.contentPiece.findMany({
    where: {
      orgId,
      type: ContentPieceType.BLOG,
      title: { startsWith: MEETING_TITLE_PREFIX },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const meetings = pieces.map((p) => {
    let analysis: MeetingAnalysis | null = null
    try {
      analysis = JSON.parse(p.content) as MeetingAnalysis
    } catch {
      // corrupt — skip
    }
    return {
      id: p.id,
      title: p.title.replace(MEETING_TITLE_PREFIX, ''),
      tags: p.hashtags,
      createdAt: p.createdAt,
      analysis,
    }
  })

  res.json(meetings)
}

/** GET /api/team/meetings/:id — get single meeting */
export async function getMeeting(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const { id } = req.params as { id: string }

  const piece = await prisma.contentPiece.findFirst({
    where: { id, orgId, type: ContentPieceType.BLOG },
  })
  if (!piece) { res.status(404).json({ error: 'Meeting not found' }); return }

  let analysis: MeetingAnalysis | null = null
  try {
    analysis = JSON.parse(piece.content) as MeetingAnalysis
  } catch {
    res.status(500).json({ error: 'Meeting data is corrupted' })
    return
  }

  res.json({
    id: piece.id,
    title: piece.title.replace(MEETING_TITLE_PREFIX, ''),
    tags: piece.hashtags,
    createdAt: piece.createdAt,
    analysis,
  })
}

/** DELETE /api/team/meetings/:id */
export async function deleteMeeting(req: AuthRequest, res: Response): Promise<void> {
  const orgId = getOrgId(req)
  if (!orgId) { res.status(400).json({ error: 'x-org-id required' }); return }

  const { id } = req.params as { id: string }
  const piece = await prisma.contentPiece.findFirst({
    where: { id, orgId, type: ContentPieceType.BLOG },
  })
  if (!piece) { res.status(404).json({ error: 'Meeting not found' }); return }

  await prisma.contentPiece.delete({ where: { id } })
  res.json({ success: true })
}
