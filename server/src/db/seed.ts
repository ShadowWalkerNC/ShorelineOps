import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from './pool'

async function seed() {
  console.log('[seed] Seeding users...')

  const adminPassword = await bcrypt.hash('ChangeMe123!', 12)

  await pool.query(`
    INSERT INTO users (name, email, password, role)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO NOTHING
  `, ['Admin User', 'admin@shoreline.app', adminPassword, 'admin'])

  console.log('[seed] Admin user created: admin@shoreline.app / ChangeMe123!')
  console.log('[seed] IMPORTANT: Change this password immediately in production.')

  await pool.end()
}

seed().catch((err) => {
  console.error('[seed] Error:', err)
  process.exit(1)
})
