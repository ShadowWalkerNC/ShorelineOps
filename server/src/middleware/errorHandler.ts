import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import crypto from 'crypto'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      requestId: req.headers['x-request-id'],
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    })
  }

  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  console.error('[Error]', { requestId, method: req.method, path: req.path, message: err.message })
  const status = (err as any).status ?? 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message
  res.status(status).json({ error: message, code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', requestId })
}
