import type { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isDev = process.env.NODE_ENV === 'development'

  // ── Prisma: unique constraint violation ─────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[])?.join(', ') ?? 'field'
      res.status(409).json({ error: 'Conflict', message: `A record with this ${fields} already exists.` })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Not found', message: 'Record not found.' })
      return
    }
    if (err.code === 'P2003') {
      res.status(400).json({ error: 'Bad request', message: 'Related record not found.' })
      return
    }
    if (err.code === 'P2014') {
      res.status(400).json({ error: 'Bad request', message: 'The change would violate a required relation.' })
      return
    }
    console.error('[PRISMA ERROR]', err.code, err.message)
    res.status(500).json({
      error: 'Database error',
      message: isDev ? err.message : 'A database error occurred.',
    })
    return
  }

  // ── Prisma: validation error ────────────────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('[PRISMA VALIDATION]', err.message)
    res.status(400).json({
      error: 'Validation error',
      message: isDev ? err.message : 'Invalid data provided.',
    })
    return
  }

  // ── JSON parse errors ───────────────────────────────────────
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Bad request', message: 'Invalid JSON in request body.' })
    return
  }

  // ── Generic ─────────────────────────────────────────────────
  console.error('[ERROR]', err.message, err.stack)
  res.status(500).json({
    error: 'Internal server error',
    message: isDev ? err.message : 'Something went wrong. Please try again.',
  })
}
