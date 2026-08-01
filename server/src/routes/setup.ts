import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { pool } from '../db/pool'

export const setupRouter = Router()

// GET /api/setup/status
setupRouter.get('/status', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM facility_config WHERE id = $1', ['default'])
    const config = rows[0]
    if (!config || !config.is_initialized) {
      return res.json({ isInitialized: false })
    }
    return res.json({
      isInitialized: true,
      facilityName: config.facility_name,
      facilityType: config.facility_type,
      primaryContactEmail: config.primary_contact_email,
      wings: typeof config.wings === 'string' ? JSON.parse(config.wings) : config.wings,
      diningRooms: typeof config.dining_rooms === 'string' ? JSON.parse(config.dining_rooms) : config.dining_rooms,
      baaAcceptedAt: config.baa_accepted_at,
    })
  } catch (err) {
    // If table doesn't exist yet, return uninitialized
    res.json({ isInitialized: false })
  }
})

// POST /api/setup/initialize
setupRouter.post('/initialize', async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query('SELECT is_initialized FROM facility_config WHERE id = $1', ['default'])
    if (existing[0]?.is_initialized) {
      return res.status(400).json({ error: 'Facility setup has already been completed and locked.' })
    }

    const body = z.object({
      facilityName: z.string().min(2),
      npiLicense: z.string().optional(),
      address: z.string().optional(),
      primaryContactEmail: z.string().email(),
      facilityType: z.enum(['Assisted Living', 'Skilled Nursing', 'Memory Care', 'Continuing Care']),
      wings: z.array(z.string()).min(1),
      diningRooms: z.array(z.string()).min(1),
      adminName: z.string().min(2),
      adminEmail: z.string().email(),
      adminPassword: z.string().min(8),
      baaSigneeName: z.string().min(2),
      initMode: z.enum(['clean', 'sample']),
    }).parse(req.body)

    const hashedPassword = await bcrypt.hash(body.adminPassword, 12)

    // Insert or update facility config
    await pool.query(
      `INSERT INTO facility_config (
        id, facility_name, npi_license, address, primary_contact_email,
        facility_type, wings, dining_rooms, is_initialized, baa_accepted_at, baa_signee_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), $9)
      ON CONFLICT (id) DO UPDATE SET
        facility_name = EXCLUDED.facility_name,
        npi_license = EXCLUDED.npi_license,
        address = EXCLUDED.address,
        primary_contact_email = EXCLUDED.primary_contact_email,
        facility_type = EXCLUDED.facility_type,
        wings = EXCLUDED.wings,
        dining_rooms = EXCLUDED.dining_rooms,
        is_initialized = true,
        baa_accepted_at = NOW(),
        baa_signee_name = EXCLUDED.baa_signee_name,
        updated_at = NOW()`,
      [
        'default',
        body.facilityName,
        body.npiLicense || '',
        body.address || '',
        body.primaryContactEmail,
        body.facilityType,
        JSON.stringify(body.wings),
        JSON.stringify(body.diningRooms),
        body.baaSigneeName,
      ]
    )

    // Create Super Admin Account
    await pool.query(
      `INSERT INTO users (name, email, password, role, mfa_enabled, active)
       VALUES ($1, $2, $3, 'admin', true, true)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = 'admin',
         active = true`,
      [body.adminName, body.adminEmail.toLowerCase(), hashedPassword]
    )

    // Audit Log for HIPAA compliance tracking
    await pool.query(
      `INSERT INTO audit_log (action, resource_type, outcome, details)
       VALUES ('SETUP_INITIALIZE', 'facility_config', 'success', $1)`,
      [JSON.stringify({ facilityName: body.facilityName, adminEmail: body.adminEmail, mode: body.initMode })]
    )

    res.json({ success: true, message: 'Facility setup successfully completed.' })
  } catch (err) { next(err) }
})
