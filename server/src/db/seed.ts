import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from './pool'

const RESIDENTS = [
  { name: 'Margaret Holloway', room: '101', status: 'Active', diet_type: 'Diabetic', texture: 'Regular', portion_size: 'Small', ensure_per_day: 1, allergies: ['Nuts'], beverages: ['Coffee', 'Water Only'], birthday_month: 'March', birthday_day: 14, serving_location: 'Dining Room', table_assignment: 'Table 2', likes: 'Oatmeal, classical music', dislikes: 'Spicy food', special_instructions: 'Needs assistance with utensils' },
  { name: 'Robert Chen', room: '102', status: 'Active', diet_type: 'Regular', texture: 'Minced', portion_size: 'Regular', ensure_per_day: 2, allergies: ['Dairy'], beverages: ['Tea', 'Juice'], birthday_month: 'July', birthday_day: 4, serving_location: 'Dining Room', table_assignment: 'Table 1', likes: 'Fish, gardening', dislikes: 'Loud noise', special_instructions: '' },
  { name: 'Dorothy Williams', room: '103', status: 'Hospital', diet_type: 'Cardiac', texture: 'Pureed', portion_size: 'Small', ensure_per_day: 2, allergies: ['Gluten'], beverages: ['Milk', 'Decaf'], birthday_month: 'November', birthday_day: 22, serving_location: 'Room', table_assignment: '', likes: 'Soup, Wheel of Fortune', dislikes: 'Cold food', special_instructions: 'Soft diet only — no bread crusts' },
  { name: 'Harold Simmons', room: '104', status: 'Active', diet_type: 'Regular', texture: 'Regular', portion_size: 'Large', ensure_per_day: 0, allergies: [], beverages: ['Coffee', 'Juice'], birthday_month: 'January', birthday_day: 30, serving_location: 'Dining Room', table_assignment: 'Table 3', likes: 'Steak, baseball', dislikes: 'Fish', special_instructions: '' },
  { name: 'Evelyn Torres', room: '105', status: 'Active', diet_type: 'Renal', texture: 'Cut-Up', portion_size: 'Regular', ensure_per_day: 1, allergies: ['Nuts', 'Seeds'], beverages: ['Water Only'], birthday_month: 'September', birthday_day: 8, serving_location: 'Dining Room', table_assignment: 'Table 2', likes: 'Reading, puzzle games', dislikes: 'Strong smells', special_instructions: 'Low potassium — no bananas or oranges' },
  { name: 'Frank Patterson', room: '106', status: 'Active', diet_type: 'Low Sodium', texture: 'Regular', portion_size: 'Regular', ensure_per_day: 0, allergies: [], beverages: ['Coffee', 'Milk'], birthday_month: 'June', birthday_day: 17, serving_location: 'Dining Room', table_assignment: 'Table 1', likes: 'Eggs, westerns', dislikes: 'Sweets', special_instructions: 'No added salt at the table' },
  { name: 'Beatrice Johnson', room: '107', status: 'Active', diet_type: 'Diabetic', texture: 'Minced & Moist', portion_size: 'Small', ensure_per_day: 2, allergies: ['Strawberries'], beverages: ['Decaf', 'Hot Chocolate'], birthday_month: 'April', birthday_day: 2, serving_location: 'Memory Care', table_assignment: 'MC-1', likes: 'Soft music, warm soup', dislikes: 'Crowded rooms', special_instructions: 'Escort to dining room, redirect if agitated' },
  { name: 'Walter Kim', room: '108', status: 'LOA', diet_type: 'Regular', texture: 'Regular', portion_size: 'Regular', ensure_per_day: 0, allergies: [], beverages: ['Tea'], birthday_month: 'December', birthday_day: 25, serving_location: 'Dining Room', table_assignment: 'Table 4', likes: 'Korean food, chess', dislikes: 'American fast food', special_instructions: '' },
]

export async function runSeed() {
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && process.env.ALLOW_AUTO_SEED !== 'true') {
    console.log('[seed] Skipping auto-seed in production (set ALLOW_AUTO_SEED=true to override)')
    return
  }

  const { rows } = await pool.query('SELECT COUNT(*) FROM users')
  if (parseInt(rows[0].count) > 0) {
    console.log('[seed] Users already exist — skipping seed')
    return
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@shoreline.local').toLowerCase()
  let adminPassword = process.env.SEED_ADMIN_PASSWORD
  let generated = false
  if (!adminPassword || adminPassword.length < 12) {
    adminPassword = crypto.randomBytes(18).toString('base64url') + 'A1!'
    generated = true
  }

  console.log('[seed] Empty database detected — seeding...')

  const hash = await bcrypt.hash(adminPassword, 12)
  await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ('Admin User', $1, $2, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, hash]
  )

  if (generated) {
    console.log(`[seed] Admin created: ${adminEmail}`)
    console.log('[seed] Generated password written once below — store it securely and rotate immediately:')
    console.log(`[seed] SEED_ADMIN_PASSWORD=${adminPassword}`)
  } else {
    console.log(`[seed] Admin created: ${adminEmail} (password from SEED_ADMIN_PASSWORD)`)
  }

  if (process.env.SEED_SAMPLE_RESIDENTS === 'true') {
    for (const r of RESIDENTS) {
      await pool.query(
        `INSERT INTO residents
          (name, room, status, diet_type, texture, portion_size, ensure_per_day,
           allergies, beverages, birthday_month, birthday_day, serving_location,
           table_assignment, likes, dislikes, special_instructions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT DO NOTHING`,
        [
          r.name, r.room, r.status, r.diet_type, r.texture, r.portion_size,
          r.ensure_per_day, r.allergies, r.beverages, r.birthday_month,
          r.birthday_day, r.serving_location, r.table_assignment,
          r.likes, r.dislikes, r.special_instructions,
        ]
      )
    }
    console.log(`[seed] ${RESIDENTS.length} sample residents inserted`)
  }

  console.log('[seed] Done.')
}

if (require.main === module) {
  import('dotenv/config').then(() =>
    runSeed()
      .then(() => pool.end())
      .catch((e) => { console.error(e); process.exit(1) })
  )
}
