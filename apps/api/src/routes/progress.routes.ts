/**
 * Server-Sent Events (SSE) endpoint for real-time job progress
 * GET /api/progress/:orgId  — streams progress events for an org's active jobs
 *
 * Each event: { step, status, message, ts }
 * Steps: org-intelligence | scan-instagram | scan-facebook | scan-youtube |
 *         competitor-discovery | seo-keywords | content-strategy | org-summary
 */

import { Router } from 'express'
import type { Response } from 'express'
import Redis from 'ioredis'
import { authenticate } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from '../middleware/auth'

const router: Router = Router()

// ── SSE progress stream ───────────────────────────────────────

router.get('/:orgId', authenticate, async (req: AuthRequest, res: Response) => {
  const { orgId } = req.params as { orgId: string }
  const userId = req.user?.sub  // JwtPayload uses 'sub' for the user id

  // Verify org membership
  const membership = await prisma.orgMember.findFirst({
    where: { orgId, userId },
  })
  const ownedOrg = await prisma.organization.findFirst({
    where: { id: orgId, ownerId: userId },
  })

  if (!membership && !ownedOrg) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable Nginx buffering
  res.flushHeaders()

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ step: 'connected', status: 'done', ts: Date.now() })}\n\n`)

  const redisUrl = process.env['REDIS_URL']

  if (!redisUrl) {
    res.write(`data: ${JSON.stringify({ step: 'error', status: 'error', message: 'Progress service unavailable', ts: Date.now() })}\n\n`)
    res.end()
    return
  }

  // Create a dedicated Redis subscriber connection (ioredis connects automatically)
  const subscriber = new Redis(redisUrl, {
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    lazyConnect: false,
  })

  subscriber.on('error', () => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ step: 'error', status: 'error', message: 'Could not connect to progress service', ts: Date.now() })}\n\n`)
      res.end()
    }
  })

  // Subscribe to org's progress channel
  // In ioredis, subscribe() puts the client into subscriber mode;
  // messages arrive via the 'message' event.
  await subscriber.subscribe(`progress:${orgId}`)

  subscriber.on('message', (_channel: string, message: string) => {
    if (!res.writableEnded) {
      res.write(`data: ${message}\n\n`)
    }
  })

  // Send any buffered events from Redis list (jobs already completed)
  const bufferedKey = `sse:progress:${orgId}`
  try {
    const tempClient = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    })
    const buffered = await tempClient.lrange(bufferedKey, 0, -1)
    await tempClient.quit()

    // Send in reverse order (oldest first)
    for (const event of buffered.reverse()) {
      if (!res.writableEnded) {
        res.write(`data: ${event}\n\n`)
      }
    }
  } catch {
    // Non-fatal — just skip buffered events
  }

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: heartbeat\n\n`)
    }
  }, 15000)

  // Cleanup on disconnect
  req.on('close', async () => {
    clearInterval(heartbeat)
    try {
      await subscriber.unsubscribe(`progress:${orgId}`)
      subscriber.disconnect()
    } catch {
      // Ignore cleanup errors
    }
  })
})

export { router as progressRouter }
