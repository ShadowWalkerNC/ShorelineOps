import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string
      role: string
    }
    req.userId = payload.sub
    req.userRole = payload.role
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(role: 'admin' | 'staff' | 'readonly') {
  const rank = { readonly: 0, staff: 1, admin: 2 }
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || rank[req.userRole as keyof typeof rank] < rank[role]) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
