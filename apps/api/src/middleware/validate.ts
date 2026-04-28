import type { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(422).json({
          error: 'Validation failed',
          message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          details: err.errors,
        })
        return
      }
      next(err)
    }
  }
}
