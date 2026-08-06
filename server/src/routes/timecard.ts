import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/requireAuth'

export const timecardRouter = Router()

const PunchSchema = z.object({
  badge_id: z.string().min(1).max(64),
  operation: z.string(),
  kiosk_id: z.string().optional().default('Default'),
  punched_at: z.string().optional(),
})

async function forwardPunchToAoD(badgeId: string, operation: 'In' | 'Out'): Promise<{ success: boolean; message: string }> {
  const aodUrl = process.env.AOD_KIOSK_URL
  if (!aodUrl) {
    // Local logging only when AoD bridge is not configured
    return { success: true, message: 'Punch accepted (local only — AOD_KIOSK_URL not set)' }
  }

  try {
    const opCode = operation === 'In' ? '1' : '2'
    const btnIndex = operation === 'In' ? '0' : '1'
    const kioskId = process.env.AOD_KIOSK_IDENTIFIER || 'Default'

    const params = new URLSearchParams()
    params.append('AE_KioskIdentifier', kioskId)
    params.append('AE_TZ', process.env.AOD_TZ || '240')
    params.append('AE_DS', '0')
    params.append('AE_InDS', '0')
    params.append('AE_Operation', opCode)
    params.append('AE_ButtonIndex', btnIndex)
    params.append('AE_DataValue', badgeId)

    console.log(`[AOD Bridge] Forwarding punch for Badge ${badgeId} (${operation})`)

    const response = await fetch(aodUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ShorelineOps/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      return { success: false, message: `AOD Server returned status ${response.status}` }
    }

    const html = await response.text()
    if (html.toLowerCase().includes('invalid badge') || html.toLowerCase().includes('error')) {
      return { success: false, message: 'Invalid Badge ID or unrecognized credential on Attendance on Demand' }
    }

    return { success: true, message: 'Punch accepted' }
  } catch (err: any) {
    console.error('[AOD Bridge] Error forwarding punch:', err)
    return { success: false, message: `Network error connecting to AOD: ${err.message}` }
  }
}

// POST /api/timecard/webhook — requires KIOSK_API_SECRET
timecardRouter.post('/webhook', async (req, res, next) => {
  try {
    const secret = process.env.KIOSK_API_SECRET
    if (!secret || secret.length < 16) {
      return res.status(503).json({ error: 'Kiosk webhook disabled — set KIOSK_API_SECRET (min 16 chars)' })
    }

    const authHeader = req.headers.authorization
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized kiosk access' })
    }

    const payload = PunchSchema.parse(req.body)
    const operation = payload.operation === 'In' || payload.operation === 'Out' ? payload.operation : 'In'

    const aodResult = await forwardPunchToAoD(payload.badge_id, operation)
    if (!aodResult.success) {
      return res.status(400).json({ error: aodResult.message })
    }

    const punchedAt = payload.punched_at ? new Date(payload.punched_at) : new Date()

    const { rows } = await pool.query(
      `INSERT INTO timecard_punches (badge_id, operation, kiosk_id, punched_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [payload.badge_id, operation, payload.kiosk_id, punchedAt]
    )

    res.status(201).json({ success: true, punch: rows[0], message: aodResult.message })
  } catch (err) {
    next(err)
  }
})

// GET /api/timecard — authenticated
timecardRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM timecard_punches ORDER BY punched_at DESC LIMIT 500'
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})
