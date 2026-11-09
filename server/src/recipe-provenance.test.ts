import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import crypto from 'crypto'
import express from 'express'
import bcrypt from 'bcryptjs'
// The root test runner builds the SDK before running this integration test.
// A runtime import keeps production server compilation independent of SDK artifacts.
const { ShorelineClient } = require('../../sdk/dist')

const directory = mkdtempSync(path.join(tmpdir(), 'shoreline-recipe-provenance-'))
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(directory, 'recipe-provenance.db')
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')

void test('clinical recipe provenance, authorization, tamper-reset, cache invalidation, and concurrency', async t => {
  const { pool } = await import('./db/pool')
  const { runMigrations } = await import('./db/migrate')
  const { requireAuth } = await import('./middleware/requireAuth')
  const { httpCacheMiddleware } = await import('./middleware/cache')
  const { authRouter } = await import('./routes/auth')
  const { recipesRouter } = await import('./routes/recipes')
  const { adminRouter } = await import('./routes/admin')
  const { tvRouter } = await import('./routes/tv')
  const { errorHandler } = await import('./middleware/errorHandler')
  const { residentsRouter } = await import('./routes/residents')
  const { hardwareRouter } = await import('./routes/hardware')
  const { trayrunsRouter } = await import('./routes/trayruns')
  const { purchasingRouter } = await import('./routes/purchasing')
  const { signTray, verifyTray } = await import('./engine/traySafety')

  await runMigrations()
  await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1')

  const password = 'Synthetic-Test-Password-43!'
  const passwordHash = await bcrypt.hash(password, 4)
  const createUser = async (role: string, name = 'Test User') => {
    const id = crypto.randomUUID()
    const email = `${id}@example.invalid`
    await pool.query(
      'INSERT INTO users (id, name, email, password, role, active, platform_admin) VALUES ($1, $2, $3, $4, $5, true, false)',
      [id, name, email, passwordHash, role]
    )
    return { id, email, name, role }
  }

  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use('/api/tv', tvRouter)
  app.use('/api/admin', requireAuth, adminRouter)
  app.use('/api/recipes', requireAuth, httpCacheMiddleware(60, 'recipes'), recipesRouter)
  app.use('/api/residents', requireAuth, residentsRouter)
  app.use('/api/hardware', requireAuth, hardwareRouter)
  app.use('/api/trayruns', requireAuth, trayrunsRouter)
  app.use('/api/purchasing', requireAuth, purchasingRouter)
  app.use(errorHandler)

  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`

  const request = (url: string, token?: string, body?: object, method = body ? 'POST' : 'GET') =>
    fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

  const login = async (email: string) => {
    const res = await request('/api/auth/login', undefined, { email, password })
    assert.equal(res.status, 200)
    return (await res.json()) as { accessToken: string; refreshToken: string; user: any }
  }

  // Pre-seed test users across role boundaries
  const dietitian = await createUser('dietitian', 'Diana RD')
  const manager = await createUser('manager', 'Mark Manager')
  const admin = await createUser('admin', 'Adam Admin')
  const staff = await createUser('staff', 'Sam Staff')
  const dietary = await createUser('dietary', 'Dan Dietary')

  const dietitianSession = await login(dietitian.email)
  const managerSession = await login(manager.email)
  const adminSession = await login(admin.email)
  const staffSession = await login(staff.email)
  const dietarySession = await login(dietary.email)

  // Obtain a display token for TV verification
  const pairReq = await request('/api/tv/pair/request', undefined, { label: 'Test TV' })
  const pairData = (await pairReq.json()) as any
  await request('/api/tv/pair/approve', adminSession.accessToken, { code: pairData.code })
  const pairStatus = await request(`/api/tv/pair/status?code=${pairData.code}&claim=${pairData.claimToken}`)
  const displayToken = ((await pairStatus.json()) as any).accessToken

  // Helper to create a recipe with verified nutrients
  const createBaseRecipe = async (name: string, nutrients = true) => {
    const createRes = await request('/api/recipes', managerSession.accessToken, {
      name,
      category: 'Entree',
      baseServings: 10,
      prepTimeMins: 15,
      cookTimeMins: 30,
      haccpTempF: 165,
      iddsiLevel: 7,
      ingredients: [
        { item: 'chicken breast', qty: '5 lb' },
        { item: 'white flour', qty: '250 g' },
      ],
      steps: [{ step: 1, instruction: 'Simmer oats until soft' }],
      notes: 'Standard therapeutic recipe',
    })
    assert.equal(createRes.status, 201)
    const recipe = (await createRes.json()) as any

    if (!nutrients) {
      await pool.query('DELETE FROM recipe_nutrients WHERE recipe_id = $1', [recipe.id])
    }
    return recipe
  }

  try {
    await t.test('unknown nutrition stays unavailable until a clinician supplies reviewed values and a source', async () => {
      const created = await request('/api/recipes', managerSession.accessToken, {
        name: 'Synthetic Unknown Nutrition', ingredients: [{ item: 'Unknown fixture ingredient', qty: '2 cases' }], baseServings: 10,
      })
      assert.equal(created.status, 201)
      const recipe = await created.json() as any
      assert.equal(recipe.nutrition, null)
      assert.equal(recipe.nutritionProvenance.available, false)
      assert.deepEqual(recipe.nutritionProvenance.missingIngredients, ['Unknown fixture ingredient'])
      assert.equal((await pool.query('SELECT * FROM recipe_nutrients WHERE recipe_id = $1', [recipe.id])).rows.length, 0)
      const denied = await request(`/api/recipes/${recipe.id}/verify-clinical`, dietitianSession.accessToken, { approvedDiets: ['NAS'] })
      assert.equal(denied.status, 422)

      // A historical calculated row and old sign-off cannot manufacture source evidence.
      await pool.query('INSERT INTO recipe_nutrients (recipe_id, calories, protein_g, sodium_mg) VALUES ($1, 999, 99, 1)', [recipe.id])
      await pool.query('UPDATE recipes SET clinical_verified = true, verified_by = $1, approved_diets = $2 WHERE id = $3', [dietitian.id, JSON.stringify(['NAS']), recipe.id])
      const legacy = await (await request(`/api/recipes/${recipe.id}`, dietitianSession.accessToken)).json() as any
      assert.equal(legacy.clinicalVerified, false)
      assert.equal(legacy.nutrition, null)
      const residentId = crypto.randomUUID()
      await pool.query(`INSERT INTO residents (id,name,room,status,profile_version,is_npo,allergies,texture,diet_type,liquid_consistency)
        VALUES ($1,'Synthetic Nutrition Review','T1','Active',1,0,$2,'Regular','NAS','Thin')`, [residentId, JSON.stringify([])])
      const ticket = signTray({ residentId, ticketId: 'synthetic-nutrition-review', version: 1, diet: 'NAS', texture: 'Regular', allergies: [], foods: [recipe.name], beverages: [], mealSlot: 'lunch', serviceDate: '2026-11-08' })
      assert.equal((await verifyTray(ticket)).status, 'HOLD_TRAY_RD_SIGNOFF')

      const perServing = { calories: 200, proteinG: 15, carbsG: 20, fatG: 5, satFatG: 1, sodiumMg: 120, potassiumMg: 100, phosphorusMg: 80, fiberG: 2, sugarG: 0 }
      const review = await request(`/api/recipes/${recipe.id}/verify-clinical`, dietitianSession.accessToken, {
        approvedDiets: ['NAS'], canonicalAllergens: [], nutritionReview: { sourceReference: 'Synthetic reviewed nutrition label for acceptance only', perServing },
      })
      assert.equal(review.status, 200)
      const after = await (await request(`/api/recipes/${recipe.id}`, dietitianSession.accessToken)).json() as any
      assert.equal(after.nutritionProvenance.source, 'clinician-reviewed')
      assert.equal(after.nutritionProvenance.estimated, false)
      assert.deepEqual(after.nutrition, perServing)
      assert.equal((await verifyTray(ticket)).status, 'VALID')
      const edit = await request(`/api/recipes/${recipe.id}`, managerSession.accessToken, { notes: 'Requires re-review' }, 'PUT')
      assert.equal(edit.status, 200)
      assert.equal((await verifyTray(ticket)).status, 'HOLD_TRAY_RD_SIGNOFF')
    })

    await t.test('POST /api/recipes/:id/verify-clinical enforces strict role authorization', async () => {
      const recipe = await createBaseRecipe('Auth Check Oatmeal')
      const payload = {
        approvedDiets: ['Regular', 'No Added Salt'],
        fluidMlPerServing: 200,
        canonicalAllergens: ['gluten'],
      }

      // Unauthenticated -> 401
      const unauth = await request(`/api/recipes/${recipe.id}/verify-clinical`, undefined, payload)
      assert.equal(unauth.status, 401)

      // Staff -> 403
      const staffRes = await request(`/api/recipes/${recipe.id}/verify-clinical`, staffSession.accessToken, payload)
      assert.equal(staffRes.status, 403)

      // Dietary -> 403
      const dietaryRes = await request(`/api/recipes/${recipe.id}/verify-clinical`, dietarySession.accessToken, payload)
      assert.equal(dietaryRes.status, 403)

      // Admin -> 403 (Administrative wildcard is intentionally blocked for clinical signoff)
      const adminRes = await request(`/api/recipes/${recipe.id}/verify-clinical`, adminSession.accessToken, payload)
      assert.equal(adminRes.status, 403)

      // Manager -> 200 OK
      const managerRes = await request(`/api/recipes/${recipe.id}/verify-clinical`, managerSession.accessToken, payload)
      assert.equal(managerRes.status, 200)

      // Dietitian -> 200 OK
      const rdRes = await request(`/api/recipes/${recipe.id}/verify-clinical`, dietitianSession.accessToken, payload)
      assert.equal(rdRes.status, 200)
    })

    await t.test('validation error boundaries: 404 missing recipe, 422 missing nutrients, 422 unmapped allergen/diet', async () => {
      const validPayload = {
        approvedDiets: ['Regular'],
        canonicalAllergens: [],
      }

      // 404 for nonexistent recipe
      const missingId = crypto.randomUUID()
      const notFoundRes = await request(`/api/recipes/${missingId}/verify-clinical`, dietitianSession.accessToken, validPayload)
      assert.equal(notFoundRes.status, 404)
      assert.equal(((await notFoundRes.json()) as any).error, 'Recipe not found')

      // 422 if recipe has no nutrient breakdown
      const recipeNoNutrients = await createBaseRecipe('Uncalculated Recipe', false)
      const noNutRes = await request(`/api/recipes/${recipeNoNutrients.id}/verify-clinical`, dietitianSession.accessToken, validPayload)
      assert.equal(noNutRes.status, 422)
      assert.match(((await noNutRes.json()) as any).error, /nutrient breakdown is required/i)

      // 422 if unmapped allergen is provided
      const recipeValid = await createBaseRecipe('Allergen Boundary Recipe')
      const invalidAllergenRes = await request(`/api/recipes/${recipeValid.id}/verify-clinical`, dietitianSession.accessToken, {
        approvedDiets: ['Regular'],
        canonicalAllergens: ['unmapped_synthetic_chemical_xyz'],
      })
      assert.equal(invalidAllergenRes.status, 422)
      assert.match(((await invalidAllergenRes.json()) as any).error, /not in the canonical clinical vocabulary/i)

      // 422 if unsupported therapeutic diet is provided
      const invalidDietRes = await request(`/api/recipes/${recipeValid.id}/verify-clinical`, dietitianSession.accessToken, {
        approvedDiets: ['unsupported_fad_diet_carnivore'],
        canonicalAllergens: [],
      })
      assert.equal(invalidDietRes.status, 422)
      assert.match(((await invalidDietRes.json()) as any).error, /unsupported therapeutic diet/i)
    })

    await t.test('clinical provenance persistence: response contract, database state, and immutable audit log', async () => {
      const recipe = await createBaseRecipe('Provenanced Porridge')
      const verifyPayload = {
        approvedDiets: ['Regular', 'No Added Salt', 'NAS', 'Cardiac', 'Diabetic'],
        fluidMlPerServing: 240,
        canonicalAllergens: ['dairy', 'gluten'],
      }

      const res = await request(`/api/recipes/${recipe.id}/verify-clinical`, dietitianSession.accessToken, verifyPayload)
      assert.equal(res.status, 200)
      const body = (await res.json()) as any

      // Response assertions
      assert.equal(body.id, recipe.id)
      assert.equal(body.name, 'Provenanced Porridge')
      assert.equal(body.clinicalVerified, true)
      assert.equal(body.verifiedBy, dietitian.id)
      assert.ok(body.verifiedAt && !isNaN(Date.parse(body.verifiedAt)))
      assert.deepEqual(body.approvedDiets, ['Regular', 'No Added Salt', 'NAS', 'Cardiac', 'Diabetic'])
      assert.equal(body.fluidMlPerServing, 240)
      // Canonical normalization check: dairy -> milk, gluten -> wheat
      assert.deepEqual(body.allergens.sort(), ['milk', 'wheat'])

      // Database persistence assertions
      const { rows } = await pool.query('SELECT * FROM recipes WHERE id = $1', [recipe.id])
      const dbRow = rows[0]
      assert.equal(Boolean(dbRow.clinical_verified), true)
      assert.equal(dbRow.verified_by, dietitian.id)
      assert.equal(dbRow.verified_at, body.verifiedAt)
      assert.equal(Number(dbRow.fluid_ml_per_serving), 240)
      const dbAllergens = typeof dbRow.allergens === 'string' ? JSON.parse(dbRow.allergens) : dbRow.allergens
      assert.deepEqual(dbAllergens.sort(), ['milk', 'wheat'])

      // Audit log assertion
      const auditRes = await pool.query(
        "SELECT * FROM audit_log WHERE resource_id = $1 AND action = 'RECIPE_CLINICAL_VERIFY'",
        [recipe.id]
      )
      assert.equal(auditRes.rows.length, 1)
      const auditRow = auditRes.rows[0]
      assert.equal(auditRow.user_id, dietitian.id)
      assert.equal(auditRow.outcome, 'success')
      assert.equal(auditRow.resource_type, 'recipe')
      const details = typeof auditRow.details === 'string' ? JSON.parse(auditRow.details) : auditRow.details
      assert.equal(details.recipeName, 'Provenanced Porridge')
      assert.equal(details.fluidMlPerServing, 240)
      assert.deepEqual(details.canonicalAllergens.sort(), ['milk', 'wheat'])
    })

    await t.test('tamper-reset on recipe edits fails tray safety closed', async () => {
      // 1. Seed active resident with allergy and restricted diet
      const residentId = crypto.randomUUID()
      await pool.query(
        `INSERT INTO residents
           (id, name, room, status, profile_version, is_npo, allergies, texture, diet_type, liquid_consistency)
         VALUES ($1, 'Clinical Test Resident', '302A', 'Active', 1, 0, $2, 'Regular', 'NAS', 'Thin')`,
        [residentId, JSON.stringify(['peanuts'])]
      )

      // 2. Create and clinically verify a recipe that satisfies the resident orders
      const recipe = await createBaseRecipe('Herb Roasted Chicken Breast')
      await pool.query(
        `UPDATE recipe_nutrients SET calories = 260, sodium_mg = 140, sat_fat_g = 2, protein_g = 35 WHERE recipe_id = $1`,
        [recipe.id]
      )

      const verifyRes = await request(`/api/recipes/${recipe.id}/verify-clinical`, dietitianSession.accessToken, {
        approvedDiets: ['Regular', 'NAS'],
        canonicalAllergens: [], // No allergens
        fluidMlPerServing: null,
      })
      assert.equal(verifyRes.status, 200)

      // 3. Issue a signed tray ticket and assert it passes validation
      const claims = {
        ticketId: 'TKT-TAMPER-TEST',
        residentId,
        version: 1,
        diet: 'NAS',
        texture: 'Regular',
        allergies: ['peanuts'],
        foods: ['Herb Roasted Chicken Breast'],
        beverages: ['Water'],
        mealSlot: 'lunch',
        serviceDate: new Date().toISOString().slice(0, 10),
      }
      const signedTicket = signTray(claims)
      const validTray = await verifyTray(signedTicket)
      assert.equal(validTray.status, 'VALID')

      // 4. Tamper with the recipe via PUT /api/recipes/:id (modify servings and instructions)
      const tamperRes = await request(`/api/recipes/${recipe.id}`, managerSession.accessToken, {
        baseServings: 24,
        notes: 'Tampered recipe note after clinical signoff',
      }, 'PUT')
      assert.equal(tamperRes.status, 200)

      // 5. Verify database columns are reset unconditionally
      const { rows } = await pool.query('SELECT * FROM recipes WHERE id = $1', [recipe.id])
      const tamperedDb = rows[0]
      assert.equal(Boolean(tamperedDb.clinical_verified), false)
      assert.equal(tamperedDb.verified_by, null)
      assert.equal(tamperedDb.verified_at, null)

      // 6. Verify GET /api/recipes/:id reflects unverified state
      const getRes = await request(`/api/recipes/${recipe.id}`, dietitianSession.accessToken)
      assert.equal(getRes.status, 200)
      const getBody = (await getRes.json()) as any
      assert.equal(getBody.clinicalVerified, false)
      assert.equal(getBody.verifiedBy, null)
      assert.equal(getBody.verifiedAt, null)

      // 7. Verify tray safety immediately fails closed
      const blockedTray = await verifyTray(signedTicket)
      assert.equal(blockedTray.status, 'HOLD_TRAY_RD_SIGNOFF')
      assert.match(blockedTray.message, /verified recipe specifications|verified canonical recipe data/i)
    })

    await t.test('recipe cache invalidation on edits and verification', async () => {
      const recipe = await createBaseRecipe('Cache Invalidation Soup')

      // Initial GET populates the cache (MISS)
      const get1 = await request(`/api/recipes/${recipe.id}`, dietitianSession.accessToken)
      assert.equal(get1.status, 200)
      assert.equal(get1.headers.get('x-cache'), 'MISS')

      // Immediate second GET is served from cache (HIT)
      const get2 = await request(`/api/recipes/${recipe.id}`, dietitianSession.accessToken)
      assert.equal(get2.status, 200)
      assert.equal(get2.headers.get('x-cache'), 'HIT')

      // Mutate recipe via PUT -> must invalidate 'recipes' cache tag
      const putRes = await request(`/api/recipes/${recipe.id}`, managerSession.accessToken, {
        name: 'Cache Invalidation Soup (Updated)',
      }, 'PUT')
      assert.equal(putRes.status, 200)

      // Next GET receives fresh data immediately (MISS)
      const get3 = await request(`/api/recipes/${recipe.id}`, dietitianSession.accessToken)
      assert.equal(get3.status, 200)
      assert.equal(get3.headers.get('x-cache'), 'MISS')
      const body3 = (await get3.json()) as any
      assert.equal(body3.name, 'Cache Invalidation Soup (Updated)')
      assert.equal(body3.clinicalVerified, false)
      assert.equal(body3.ingredients.length, 2, 'name-only edits preserve saved ingredients instead of applying create defaults')
      assert.equal(body3.ingredients[0].qty, '5 lb')

      // Cache is now warm again (HIT)
      const get4 = await request(`/api/recipes/${recipe.id}`, dietitianSession.accessToken)
      assert.equal(get4.status, 200)
      assert.equal(get4.headers.get('x-cache'), 'HIT')

      // Verify clinically via POST /verify-clinical -> must invalidate 'recipes' cache tag
      const verifyRes = await request(`/api/recipes/${recipe.id}/verify-clinical`, dietitianSession.accessToken, {
        approvedDiets: ['Regular'],
        canonicalAllergens: [],
      })
      assert.equal(verifyRes.status, 200)

      // Next GET receives fresh verification state immediately (MISS)
      const get5 = await request(`/api/recipes/${recipe.id}`, dietitianSession.accessToken)
      assert.equal(get5.status, 200)
      assert.equal(get5.headers.get('x-cache'), 'MISS')
      const body5 = (await get5.json()) as any
      assert.equal(body5.clinicalVerified, true)
      assert.equal(body5.verifiedBy, dietitian.id)
    })

    await t.test('concurrency: concurrent recipe verifications serialize cleanly without corrupting state', async () => {
      const recipe = await createBaseRecipe('Concurrent Verification Chowder')

      // 2 simultaneous verification requests for the same recipe
      const results = await Promise.all([
        request(`/api/recipes/${recipe.id}/verify-clinical`, dietitianSession.accessToken, {
          approvedDiets: ['Regular', 'No Added Salt'],
          fluidMlPerServing: 150,
          canonicalAllergens: ['fish'],
        }),
        request(`/api/recipes/${recipe.id}/verify-clinical`, dietitianSession.accessToken, {
          approvedDiets: ['Regular', 'No Added Salt'],
          fluidMlPerServing: 180,
          canonicalAllergens: ['fish'],
        }),
      ])

      for (const res of results) {
        assert.equal(res.status, 200)
      }

      // Check DB consistency
      const { rows } = await pool.query('SELECT * FROM recipes WHERE id = $1', [recipe.id])
      assert.equal(rows.length, 1)
      assert.equal(Boolean(rows[0].clinical_verified), true)
      assert.equal(rows[0].verified_by, dietitian.id)

      // Audit log must have 2 entries without lock failure
      const auditRes = await pool.query(
        "SELECT COUNT(*) AS c FROM audit_log WHERE resource_id = $1 AND action = 'RECIPE_CLINICAL_VERIFY'",
        [recipe.id]
      )
      assert.equal(Number(auditRes.rows[0].c), 2)
    })

    await t.test('concurrency: TV display pairing approvals serialize and claim token is single-use', async () => {
      // 1. Concurrent approve requests for the same pairing code
      const pairReq2 = await request('/api/tv/pair/request', undefined, { label: 'Concurrency Wall TV' })
      const pairData2 = (await pairReq2.json()) as any
      const approveResults = await Promise.all(
        Array.from({ length: 10 }, () =>
          request('/api/tv/pair/approve', adminSession.accessToken, { code: pairData2.code })
        )
      )
      const statuses = approveResults.map(r => r.status)
      assert.equal(statuses.filter(s => s === 200).length, 1, 'Exactly 1 approval request must succeed')
      assert.equal(statuses.filter(s => s === 409).length, 9, 'All other concurrent approval requests must return 409')

      // 2. Concurrent status claims for the approved code: single-use claim token
      const claimPolls = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(`/api/tv/pair/status?code=${pairData2.code}&claim=${pairData2.claimToken}`)
        )
      )
      const pollStatuses = claimPolls.map(p => p.status)
      assert.equal(pollStatuses.filter(s => s === 200).length, 1, 'Exactly 1 poll consumes the single-use token')
      assert.equal(pollStatuses.filter(s => s === 404).length, 9, 'Subsequent polls return 404')
    })

    await t.test('shift CRUD integration with TV Schedule Today and zero PHI leakage', async () => {
      const today = new Date().toISOString().slice(0, 10)

      // 1. Create shift via manager API
      const createRes = await request('/api/admin/shifts', managerSession.accessToken, {
        staff_name: 'Robin Wood',
        position: 'Line Cook',
        station: 'Grill Station',
        shift_date: today,
        shift_window: 'Evening',
      })
      assert.equal(createRes.status, 201)
      const created = (await createRes.json()) as any

      // 2. Query schedule-today with display token -> shift appears
      const sched1 = await request('/api/tv/schedule-today', displayToken)
      assert.equal(sched1.status, 200)
      const body1 = (await sched1.json()) as any
      const robin = body1.shifts.find((s: any) => s.name === 'Robin Wood')
      assert.ok(robin, 'Created shift must appear on TV schedule-today')
      assert.equal(robin.position, 'Line Cook')
      assert.equal(robin.shift, 'Evening')
      assert.equal(robin.station, 'Grill Station')

      // 3. Update shift with call_out and private medical details
      const updateRes = await request(`/api/admin/shifts/${created.id}`, managerSession.accessToken, {
        call_out: true,
        call_out_reason: 'Infectious Diarrhea',
        notes: 'Strict HIPAA protected isolation record 88102',
      }, 'PUT')
      assert.equal(updateRes.status, 200)

      // 4. Query schedule-today -> call-out count updated, zero PHI leakage
      const sched2 = await request('/api/tv/schedule-today', displayToken)
      assert.equal(sched2.status, 200)
      const body2 = (await sched2.json()) as any
      assert.ok(body2.coverage.callOuts >= 1)
      const jsonStr = JSON.stringify(body2).toLowerCase()
      for (const secret of ['diarrhea', 'infectious', 'hipaa', 'protected', 'isolation', '88102']) {
        assert.ok(!jsonStr.includes(secret), `Zero PHI invariant violated: leaked "${secret}"`)
      }

      // 5. Clear call_out
      const clearRes = await request(`/api/admin/shifts/${created.id}`, managerSession.accessToken, {
        call_out: false,
      }, 'PUT')
      assert.equal(clearRes.status, 200)

      // 6. Delete shift -> removed from TV display
      const delRes = await request(`/api/admin/shifts/${created.id}`, managerSession.accessToken, undefined, 'DELETE')
      assert.equal(delRes.status, 200)
      const sched3 = await request('/api/tv/schedule-today', displayToken)
      const body3 = (await sched3.json()) as any
      assert.ok(!body3.shifts.some((s: any) => s.name === 'Robin Wood'))
    })
    await t.test('SDK talks to actual facility recipe, resident, HACCP and signed-tray routes', async () => {
      const client = new ShorelineClient({ baseUrl: base, apiKey: managerSession.accessToken })
      const clinical = new ShorelineClient({ baseUrl: base, apiKey: dietitianSession.accessToken })
      const imported = await client.importCensusCsv('name,room,status,dietType,texture,liquidConsistency,isNpo\nSynthetic SDK Resident,SDK-1,Active,Regular,Regular,Thin,false')
      assert.equal(imported.created, 1)
      const census = await client.getCensus()
      assert.equal(census.source, 'resident-list')
      assert.ok(census.residents.some((resident: { name: string; dietType: string; isNpo: boolean }) => resident.name === 'Synthetic SDK Resident' && resident.dietType === 'Regular' && resident.isNpo === false))
      const recipe = await createBaseRecipe('Synthetic SDK Known Recipe')
      assert.equal((await client.getRecipe(recipe.id)).nutritionProvenance.source, 'local-reference')
      const unavailable = await client.analyzeRecipeNutrition({ ingredients: [{ item: 'Unknown SDK ingredient', qty: '2 cases' }] })
      assert.equal(unavailable.perServing, null)
      assert.equal(unavailable.nutritionProvenance.available, false)
      assert.equal((await clinical.verifyRecipeClinical(recipe.id, { approvedDiets: ['Regular'], canonicalAllergens: [] })).clinicalVerified, true)
      const log = await client.logHaccpTemperature({ checkType: 'food', itemName: 'Synthetic SDK temperature check', tempF: 165 })
      assert.equal(log.success, true)
      assert.equal(Number(log.record.temp_f), 165)
      assert.equal(typeof (await client.getHaccpSchedule()).generatedAt, 'string')
      const runResponse = await request('/api/trayruns', managerSession.accessToken, { mealSlot: 'lunch', serviceDate: '2026-11-08' })
      assert.equal(runResponse.status, 201)
      const run = await runResponse.json() as { id: string }
      assert.ok((await client.getTrayRuns('2026-11-08', 'lunch')).some((item: { id: string }) => item.id === run.id))
      await assert.rejects(client.recordTrayEvent(run.id, { event: 'assembled', rawQrPayload: 'invalid-synthetic-card' }), (error: unknown) => (error as { status?: number }).status === 409)
    })
  } finally {
    server.close()
  }
})
