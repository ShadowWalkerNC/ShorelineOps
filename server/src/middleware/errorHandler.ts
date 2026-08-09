import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    })
  }

  console.error('[Error]', err.message)
  const status = (err as any).status ?? 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message
  res.status(status).json({ error: message })
}
