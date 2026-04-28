import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt'
import type { UserRole, JwtPayload } from '@socialpulse/shared'

export interface AuthRequest extends Request {
  user?: JwtPayload
  // Explicitly re-declare Express Request members so tsc resolves them
  // even when @types/express resolves through pnpm symlinks in the workspace
  body: Record<string, unknown>
  params: Record<string, string>
  query: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'] as string | undefined
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' })
    return
  }

  const token = authHeader.slice(7)
  try {
    req.user = verifyAccessToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' })
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' })
      return
    }
    next()
  }
}
