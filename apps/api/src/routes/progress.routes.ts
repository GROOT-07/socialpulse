/**
 * Server-Sent Events (SSE) endpoint for real-time job progress
 * GET /api/progress/:orgId  — streams progress events for an org's active jobs
 *
 * Each event: { step, status, message, ts }
 * Steps: org-intelligence | scan-instagram | scan-facebook | scan-youtube |
 *         competitor-discovery | seo-keywords | content-strategy | org-summary
 */

import { Router, type Request, type Response } from 'express'
import { createClient } from 'ioredis'
import { authenticate } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from '../middleware/auth'

const router: Router = Router()

// ── SSE progress stream ───────────────────────────────────────

router.get('/:orgId', authenticate, async (req: AuthRequest, res: Response) => {
  const { orgId } = req.params as { orgId: string }
  const userId = req.user?.userId

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

  // Create a dedicated Redis subscriber connection
  const subscriber = createClient({
    url: process.env['REDIS_URL'],
    socket: { tls: process.env['REDIS_URL']?.startsWith('rediss://') },
  })

  try {
    await subscriber.connect()
  } catch (err: unknown) {
    res.write(`data: ${JSON.stringify({ step: 'error', status: 'error', message: 'Could not connect to progress service', ts: Date.now() })}\n\n`)
    res.end()
    return
  }

  // Subscribe to org's progress channel
  await subscriber.subscribe(`progress:${orgId}`, (message) => {
    if (!res.writableEnded) {
      res.write(`data: ${message}\n\n`)
    }
  })

  // Send any buffered events from Redis list (jobs already completed)
  const bufferedKey = `sse:progress:${orgId}`
  try {
    const redisUrl = process.env['REDIS_URL']
    if (redisUrl) {
      const tempClient = createClient({ url: redisUrl, socket: { tls: redisUrl.startsWith('rediss://') } })
      await tempClient.connect()
      const buffered = await tempClient.lRange(bufferedKey, 0, -1)
      await tempClient.quit()

      // Send in reverse order (oldest first)
      for (const event of buffered.reverse()) {
        if (!res.writableEnded) {
          res.write(`data: ${event}\n\n`)
        }
      }
    }
  } catch (err: unknown) {
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
      await subscriber.quit()
    } catch (err: unknown) {
      // Ignore cleanup errors
    }
  })
})

export { router as progressRouter }
