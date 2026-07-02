import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[Error]', err.message)
  const status = (err as any).status ?? 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message
  res.status(status).json({ error: message })
}
