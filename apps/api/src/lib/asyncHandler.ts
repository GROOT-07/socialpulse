import type { Request, Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth'

type AsyncHandler<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction,
) => Promise<void>

/**
 * Wraps an async Express route handler so that any rejected promise is
 * forwarded to Express's error middleware (errorHandler.ts) instead of
 * causing an unhandled rejection that crashes the process silently.
 *
 * Express 4 does not catch async errors natively — this is required for
 * every async controller.
 */
export function wrap<T extends Request = Request>(
  fn: AsyncHandler<T>,
): (req: T, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

/** Shorthand alias for AuthRequest-based controllers */
export const wrapAuth = wrap<AuthRequest>
