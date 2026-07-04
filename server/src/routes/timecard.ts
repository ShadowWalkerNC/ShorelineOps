import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/requireAuth'

export const timecardRouter = Router()

const PunchSchema = z.object({
  badge_id: z.string(),
  operation: z.string(), // 'In' or 'Out'
  kiosk_id: z.string().optional().default('Default'),
  punched_at: z.string().optional(),
})

// Function to forward punch to live Attendance on Demand server
async function forwardPunchToAoD(badgeId: string, operation: 'In' | 'Out'): Promise<{ success: boolean; message: string }> {
  try {
    const url = 'https://firstatlantic.attendanceondemand.com/kiosk/MAINPAGE'
    
    // Map operation to AOD params
    // 1 = Clock In, 2 = Clock Out
    const opCode = operation === 'In' ? '1' : '2'
    const btnIndex = operation === 'In' ? '0' : '1'

    const params = new URLSearchParams()
    params.append('AE_KioskIdentifier', 'Default')
    params.append('AE_TZ', '240')
    params.append('AE_DS', '0')
    params.append('AE_InDS', '0')
    params.append('AE_Operation', opCode)
    params.append('AE_ButtonIndex', btnIndex)
    params.append('AE_DataValue', badgeId)

    console.log(`[AOD Bridge] Forwarding punch for Badge ${badgeId} (${operation}) to AOD...`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      body: params.toString()
    })

    if (!response.ok) {
      return { success: false, message: `AOD Server returned status ${response.status}` }
    }

    const html = await response.text()

    // Analyze HTML response for success or error indicators
    // AOD kiosk typically shows "Invalid Badge" or similar errors in the markup.
    // If it contains "Invalid" or "not found" or "error", we fail.
    if (html.toLowerCase().includes('invalid badge') || html.toLowerCase().includes('error')) {
      return { success: false, message: 'Invalid Badge ID or unrecognized credential on Attendance on Demand' }
    }

    return { success: true, message: 'Punch accepted' }
  } catch (err: any) {
    console.error('[AOD Bridge] Error forwarding punch:', err)
    return { success: false, message: `Network error connecting to AOD: ${err.message}` }
  }
}

// POST /api/timecard/webhook - Receives punch and pushes it to AoD and saves it locally
timecardRouter.post('/webhook', async (req, res, next) => {
  try {
    const secret = process.env.KIOSK_API_SECRET
    if (secret) {
      const authHeader = req.headers.authorization
      if (!authHeader || authHeader !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Unauthorized kiosk access' })
      }
    }

    const payload = PunchSchema.parse(req.body)
    const operation = payload.operation === 'In' || payload.operation === 'Out' ? payload.operation : 'In'

    // Forward the punch to the real Attendance on Demand server first
    const aodResult = await forwardPunchToAoD(payload.badge_id, operation)

    if (!aodResult.success) {
      return res.status(400).json({ error: aodResult.message })
    }

    const punchedAt = payload.punched_at ? new Date(payload.punched_at) : new Date()

    // Write to our local PostgreSQL database
    const { rows } = await pool.query(
      `INSERT INTO timecard_punches (badge_id, operation, kiosk_id, punched_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [payload.badge_id, operation, payload.kiosk_id, punchedAt]
    )

    res.status(201).json({ success: true, punch: rows[0], message: 'Punch logged on AoD and Shoreline database.' })
  } catch (err) {
    next(err)
  }
})

// GET /api/timecard - Authenticated query endpoint to fetch recent punches
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
