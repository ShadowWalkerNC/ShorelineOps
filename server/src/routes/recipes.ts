/**
 * Recipes API — ShorelineOps
 * 
 * Provides master recipe management, automated Big 9 allergen scanning,
 * USDA/institutional macro & micronutrient calculation, vendor item costing,
 * and dynamic batch scaling for kitchen line cooks.
 */

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireCapability } from '../middleware/permissions'
import type { AuthRequest } from '../middleware/requireAuth'
import { DietaryNutritionalEngine } from '../engine/nutrition'
import { KitchenProductionEngine } from '../engine/production'
import { normalizeCanonicalAllergen, resolveDietContract } from '../engine/traySafety'
import {
  RecipeCostingEngine,
  fetchVendorCatalog,
  recalcRecipeCost,
  recalcAllRecipeCosts,
  type CostProvenance,
} from '../engine/costing'

export const recipesRouter = Router()

const RecipeIngredientSchema = z.object({
  qty: z.string().min(1),
  item: z.string().min(1),
  vendorSku: z.string().optional(),
  estimatedCost: z.number().optional(),
  yieldPct: z.number().optional(),
})

const RecipeStepSchema = z.object({
  step: z.number().int().min(1),
  instruction: z.string().min(1),
})

const RecipeBodySchema = z.object({
  name: z.string().min(1),
  category: z.string().default('Other'),
  baseServings: z.number().min(1).default(10),
  prepTimeMins: z.number().int().min(0).default(15),
  cookTimeMins: z.number().int().min(0).default(30),
  haccpTempF: z.number().default(165),
  iddsiLevel: z.number().int().min(1).max(7).default(7),
  ingredients: z.array(RecipeIngredientSchema).default([]),
  steps: z.array(RecipeStepSchema).default([]),
  notes: z.string().default(''),
})

const RecipeClinicalVerifySchema = z.object({
  approvedDiets: z.array(z.string().min(1)).default([]),
  fluidMlPerServing: z.number().int().min(0).nullable().optional(),
  canonicalAllergens: z.array(z.string().min(1)).optional(),
})

/**
 * GET /api/recipes
 * List all master recipes with allergen tags and nutritional summary.
 * costProvenance is computed live from current vendor-catalog coverage so the
 * SKU-matched vs estimated flag always reflects reality, never stale data.
 */
recipesRouter.get('/', requireCapability('recipes.read'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, 
             rn.calories, rn.protein_g, rn.carbs_g, rn.fat_g, rn.sodium_mg, rn.fiber_g
      FROM recipes r
      LEFT JOIN recipe_nutrients rn ON rn.recipe_id = r.id
      ORDER BY r.category, r.name ASC
    `)
    const catalog = await fetchVendorCatalog(pool)

    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      baseServings: parseFloat(r.base_servings),
      prepTimeMins: r.prep_time_mins,
      cookTimeMins: r.cook_time_mins,
      haccpTempF: parseFloat(r.haccp_temp_f || 165),
      iddsiLevel: r.iddsi_level,
      allergens: r.allergens || [],
      ingredients: r.ingredients || [],
      steps: r.steps || [],
      notes: r.notes || '',
      clinicalVerified: Boolean(r.clinical_verified),
      verifiedBy: r.verified_by ?? null,
      verifiedAt: r.verified_at ?? null,
      approvedDiets: r.approved_diets || [],
      fluidMlPerServing: r.fluid_ml_per_serving !== null && r.fluid_ml_per_serving !== undefined ? Number(r.fluid_ml_per_serving) : null,
      costPerServing: parseFloat(r.cost_per_serving || 0),
      costProvenance: RecipeCostingEngine.ingredientProvenance(
        (typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : r.ingredients) || [],
        catalog
      ) as CostProvenance,
      nutrition: r.calories !== null ? {
        calories: parseFloat(r.calories || 0),
        proteinG: parseFloat(r.protein_g || 0),
        carbsG: parseFloat(r.carbs_g || 0),
        fatG: parseFloat(r.fat_g || 0),
        sodiumMg: parseFloat(r.sodium_mg || 0),
        fiberG: parseFloat(r.fiber_g || 0),
      } : undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })))
  } catch (err) { next(err) }
})

/**
 * GET /api/recipes/:id
 */
recipesRouter.get('/:id', requireCapability('recipes.read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, rn.* 
      FROM recipes r
      LEFT JOIN recipe_nutrients rn ON rn.recipe_id = r.id
      WHERE r.id = $1
    `, [req.params.id])

    if (!rows[0]) return res.status(404).json({ error: 'Recipe not found' })
    const r = rows[0]

    const ingredients = (typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : r.ingredients) || []
    const catalog = await fetchVendorCatalog(pool)
    const costBreakdown = RecipeCostingEngine.costRecipe(
      ingredients,
      parseFloat(r.base_servings) || 1,
      catalog,
      r.id
    )

    res.json({
      id: r.id,
      name: r.name,
      category: r.category,
      baseServings: parseFloat(r.base_servings),
      prepTimeMins: r.prep_time_mins,
      cookTimeMins: r.cook_time_mins,
      haccpTempF: parseFloat(r.haccp_temp_f || 165),
      iddsiLevel: r.iddsi_level,
      allergens: r.allergens || [],
      ingredients: r.ingredients || [],
      steps: r.steps || [],
      notes: r.notes || '',
      clinicalVerified: Boolean(r.clinical_verified),
      verifiedBy: r.verified_by ?? null,
      verifiedAt: r.verified_at ?? null,
      approvedDiets: r.approved_diets || [],
      fluidMlPerServing: r.fluid_ml_per_serving !== null && r.fluid_ml_per_serving !== undefined ? Number(r.fluid_ml_per_serving) : null,
      costPerServing: parseFloat(r.cost_per_serving || 0),
      costProvenance: costBreakdown.provenance,
      costBreakdown, // per-line source flags (sku / estimated / none)
      nutrition: {
        calories: parseFloat(r.calories || 0),
        proteinG: parseFloat(r.protein_g || 0),
        carbsG: parseFloat(r.carbs_g || 0),
        fatG: parseFloat(r.fat_g || 0),
        satFatG: parseFloat(r.sat_fat_g || 0),
        sodiumMg: parseFloat(r.sodium_mg || 0),
        potassiumMg: parseFloat(r.potassium_mg || 0),
        phosphorusMg: parseFloat(r.phosphorus_mg || 0),
        fiberG: parseFloat(r.fiber_g || 0),
        sugarG: parseFloat(r.sugar_g || 0),
      },
    })
  } catch (err) { next(err) }
})

/**
 * POST /api/recipes
 * Create recipe, auto-detect allergens, and compute macro/micronutrients
 */
recipesRouter.post('/', requireCapability('recipes.write'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await pool.connect()
  try {
    const data = RecipeBodySchema.parse(req.body)
    
    // 1. Calculate nutrition & allergens via engine
    const analysis = DietaryNutritionalEngine.calculateRecipeNutrition(data.ingredients, data.baseServings)

    await client.query('BEGIN')

    const { rows: [recipe] } = await client.query(`
      INSERT INTO recipes 
        (name, category, base_servings, prep_time_mins, cook_time_mins, haccp_temp_f, iddsi_level, allergens, ingredients, steps, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      data.name,
      data.category,
      data.baseServings,
      data.prepTimeMins,
      data.cookTimeMins,
      data.haccpTempF,
      data.iddsiLevel,
      analysis.allergens,
      JSON.stringify(data.ingredients),
      JSON.stringify(data.steps),
      data.notes,
    ])

    // 1b. Roll up cost_per_serving from the vendor catalog (C06): SKU-matched
    // vendor unit_cost wins; ingredient estimatedCost is the flagged fallback.
    const costCatalog = await fetchVendorCatalog(client)
    const costBreakdown = RecipeCostingEngine.costRecipe(
      data.ingredients, data.baseServings, costCatalog, recipe.id
    )
    await client.query(
      `UPDATE recipes SET cost_per_serving = $1 WHERE id = $2`,
      [costBreakdown.costPerServing, recipe.id]
    )

    // 2. Persist nutritional profile
    await client.query(`
      INSERT INTO recipe_nutrients 
        (recipe_id, calories, protein_g, carbs_g, fat_g, sat_fat_g, sodium_mg, potassium_mg, phosphorus_mg, fiber_g, sugar_g)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (recipe_id) DO UPDATE SET
        calories = EXCLUDED.calories,
        protein_g = EXCLUDED.protein_g,
        carbs_g = EXCLUDED.carbs_g,
        fat_g = EXCLUDED.fat_g,
        sat_fat_g = EXCLUDED.sat_fat_g,
        sodium_mg = EXCLUDED.sodium_mg,
        potassium_mg = EXCLUDED.potassium_mg,
        phosphorus_mg = EXCLUDED.phosphorus_mg,
        fiber_g = EXCLUDED.fiber_g,
        sugar_g = EXCLUDED.sugar_g,
        calculated_at = NOW()
    `, [
      recipe.id,
      analysis.perServing.calories,
      analysis.perServing.proteinG,
      analysis.perServing.carbsG,
      analysis.perServing.fatG,
      analysis.perServing.satFatG,
      analysis.perServing.sodiumMg,
      analysis.perServing.potassiumMg,
      analysis.perServing.phosphorusMg,
      analysis.perServing.fiberG,
      analysis.perServing.sugarG,
    ])

    await client.query('COMMIT')

    res.status(201).json({
      ...recipe,
      cost_per_serving: costBreakdown.costPerServing,
      costProvenance: costBreakdown.provenance,
      costBreakdown,
      nutrition: analysis.perServing,
      ingredientContributions: analysis.ingredientContributions,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

/**
 * PUT /api/recipes/:id
 */
recipesRouter.put('/:id', requireCapability('recipes.write'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await pool.connect()
  try {
    const data = RecipeBodySchema.partial().parse(req.body)
    const { rows: existing } = await pool.query('SELECT * FROM recipes WHERE id = $1', [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Recipe not found' })

    const mergedIngredientsRaw = data.ingredients ?? existing[0].ingredients
    const mergedIngredients = typeof mergedIngredientsRaw === 'string'
      ? JSON.parse(mergedIngredientsRaw)
      : mergedIngredientsRaw
    const mergedServings = data.baseServings ?? parseFloat(existing[0].base_servings)

    const analysis = DietaryNutritionalEngine.calculateRecipeNutrition(mergedIngredients, mergedServings)

    await client.query('BEGIN')

    // C06: recompute cost_per_serving from current vendor catalog on every save
    const costCatalogPut = await fetchVendorCatalog(client)
    const costBreakdownPut = RecipeCostingEngine.costRecipe(
      mergedIngredients, mergedServings, costCatalogPut, req.params.id
    )

    const { rows: [updated] } = await client.query(`
      UPDATE recipes SET
        name              = COALESCE($1, name),
        category          = COALESCE($2, category),
        base_servings     = COALESCE($3, base_servings),
        prep_time_mins    = COALESCE($4, prep_time_mins),
        cook_time_mins    = COALESCE($5, cook_time_mins),
        haccp_temp_f      = COALESCE($6, haccp_temp_f),
        iddsi_level       = COALESCE($7, iddsi_level),
        allergens         = $8,
        ingredients       = COALESCE($9, ingredients),
        steps             = COALESCE($10, steps),
        notes             = COALESCE($11, notes),
        cost_per_serving  = $12,
        clinical_verified = false,
        verified_by       = NULL,
        verified_at       = NULL,
        updated_at        = NOW()
      WHERE id = $13
      RETURNING *
    `, [
      data.name ?? null,
      data.category ?? null,
      data.baseServings ?? null,
      data.prepTimeMins ?? null,
      data.cookTimeMins ?? null,
      data.haccpTempF ?? null,
      data.iddsiLevel ?? null,
      analysis.allergens,
      data.ingredients ? JSON.stringify(data.ingredients) : null,
      data.steps ? JSON.stringify(data.steps) : null,
      data.notes ?? null,
      costBreakdownPut.costPerServing,
      req.params.id,
    ])

    await client.query(`
      INSERT INTO recipe_nutrients 
        (recipe_id, calories, protein_g, carbs_g, fat_g, sat_fat_g, sodium_mg, potassium_mg, phosphorus_mg, fiber_g, sugar_g)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (recipe_id) DO UPDATE SET
        calories = EXCLUDED.calories,
        protein_g = EXCLUDED.protein_g,
        carbs_g = EXCLUDED.carbs_g,
        fat_g = EXCLUDED.fat_g,
        sat_fat_g = EXCLUDED.sat_fat_g,
        sodium_mg = EXCLUDED.sodium_mg,
        potassium_mg = EXCLUDED.potassium_mg,
        phosphorus_mg = EXCLUDED.phosphorus_mg,
        fiber_g = EXCLUDED.fiber_g,
        sugar_g = EXCLUDED.sugar_g,
        calculated_at = NOW()
    `, [
      req.params.id,
      analysis.perServing.calories,
      analysis.perServing.proteinG,
      analysis.perServing.carbsG,
      analysis.perServing.fatG,
      analysis.perServing.satFatG,
      analysis.perServing.sodiumMg,
      analysis.perServing.potassiumMg,
      analysis.perServing.phosphorusMg,
      analysis.perServing.fiberG,
      analysis.perServing.sugarG,
    ])

    await client.query('COMMIT')

    res.json({
      ...updated,
      costProvenance: costBreakdownPut.provenance,
      costBreakdown: costBreakdownPut,
      nutrition: analysis.perServing,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

/**
 * POST /api/recipes/:id/verify-clinical
 * Registered Dietitian / clinical manager signoff establishing canonical
 * allergen equivalence, approved therapeutic diets, and fluid mL per serving.
 */
recipesRouter.post('/:id/verify-clinical', requireCapability('residents.clinicalWrite'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await pool.connect()
  try {
    const data = RecipeClinicalVerifySchema.parse(req.body)
    await client.query('BEGIN')

    const { rows } = await client.query('SELECT * FROM recipes WHERE id = $1', [req.params.id])
    const recipe = rows[0]
    if (!recipe) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Recipe not found' })
    }

    const nutRows = await client.query('SELECT * FROM recipe_nutrients WHERE recipe_id = $1', [req.params.id])
    if (!nutRows.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(422).json({ error: 'Recipe nutrient breakdown is required before clinical verification' })
    }

    const existingAllergensRaw = recipe.allergens
    const existingAllergens: string[] = Array.isArray(existingAllergensRaw)
      ? existingAllergensRaw
      : typeof existingAllergensRaw === 'string' && existingAllergensRaw !== '{}'
        ? JSON.parse(existingAllergensRaw)
        : []

    const combinedAllergens = data.canonicalAllergens ?? existingAllergens
    const normalizedAllergens: string[] = []
    for (const allergen of combinedAllergens) {
      const canonical = normalizeCanonicalAllergen(allergen)
      if (!canonical) {
        await client.query('ROLLBACK')
        return res.status(422).json({ error: `Unmapped allergen "${allergen}" is not in the canonical clinical vocabulary` })
      }
      if (!normalizedAllergens.includes(canonical)) normalizedAllergens.push(canonical)
    }

    for (const diet of data.approvedDiets) {
      if (diet.trim().toLowerCase() !== 'regular' && !resolveDietContract(diet)) {
        await client.query('ROLLBACK')
        return res.status(422).json({ error: `Unsupported therapeutic diet "${diet}"` })
      }
    }

    const verifiedAt = new Date().toISOString()
    await client.query(
      `UPDATE recipes SET
         clinical_verified = true,
         verified_by = $1,
         verified_at = $2,
         approved_diets = $3,
         fluid_ml_per_serving = $4,
         allergens = $5,
         updated_at = NOW()
       WHERE id = $6`,
      [
        req.userId,
        verifiedAt,
        data.approvedDiets,
        data.fluidMlPerServing ?? null,
        normalizedAllergens,
        req.params.id,
      ]
    )

    await client.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('RECIPE_CLINICAL_VERIFY', $1, $2, 'recipe', 'success', $3)`,
      [
        req.userId,
        req.params.id,
        JSON.stringify({
          recipeName: recipe.name,
          approvedDiets: data.approvedDiets,
          fluidMlPerServing: data.fluidMlPerServing ?? null,
          canonicalAllergens: normalizedAllergens,
        }),
      ]
    )

    const { rows: [updated] } = await client.query('SELECT * FROM recipes WHERE id = $1', [req.params.id])
    await client.query('COMMIT')

    res.json({
      id: updated.id,
      name: updated.name,
      clinicalVerified: Boolean(updated.clinical_verified),
      verifiedBy: updated.verified_by,
      verifiedAt: updated.verified_at,
      approvedDiets: updated.approved_diets || [],
      fluidMlPerServing: updated.fluid_ml_per_serving !== null && updated.fluid_ml_per_serving !== undefined ? Number(updated.fluid_ml_per_serving) : null,
      allergens: updated.allergens || [],
    })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

/**
 * DELETE /api/recipes/:id
 */
recipesRouter.delete('/:id', requireCapability('recipes.delete'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows: existing } = await pool.query('SELECT id FROM recipes WHERE id = $1', [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Recipe not found' })
    await pool.query('DELETE FROM recipes WHERE id = $1', [req.params.id])
    res.status(204).send()
  } catch (err) { next(err) }
})

/**
 * POST /api/recipes/recalc-costs
 * Idempotent backfill: recompute cost_per_serving for recipes from the current
 * vendor catalog and overwrite stored values. Safe to re-run any number of
 * times — same inputs always produce the same stored values.
 * Body: { recipeIds?: string[] } (omit to recalc all)
 */
recipesRouter.post('/recalc-costs', requireCapability('recipes.write'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { recipeIds } = (req.body ?? {}) as { recipeIds?: string[] }
    if (Array.isArray(recipeIds) && recipeIds.length > 0) {
      const results: Array<{ id: string; name: string; costPerServing: number; provenance: CostProvenance }> = []
      for (const id of recipeIds) {
        const breakdown = await recalcRecipeCost(pool, id)
        if (breakdown) {
          const { rows } = await pool.query(`SELECT name FROM recipes WHERE id = $1`, [id])
          results.push({ id, name: rows[0]?.name ?? '', costPerServing: breakdown.costPerServing, provenance: breakdown.provenance })
        }
      }
      return res.json({ updated: results.length, results, idempotent: true })
    }
    const result = await recalcAllRecipeCosts(pool)
    res.json({ ...result, idempotent: true })
  } catch (err) { next(err) }
})

/**
 * POST /api/recipes/:id/scale
 * Scales recipe to specified batch portion count for kitchen line cooks.
 * Cost per serving is invariant to scale; the response carries the stored
 * cost_per_serving plus batch totals and the live cost-provenance flag.
 */
recipesRouter.post('/:id/scale', requireCapability('recipes.read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { portions = 50, texture = 'Regular' } = req.body
    const { rows } = await pool.query('SELECT * FROM recipes WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Recipe not found' })

    const batch = KitchenProductionEngine.scaleRecipeForBatch({
      id: rows[0].id,
      name: rows[0].name,
      category: rows[0].category,
      baseServings: parseFloat(rows[0].base_servings),
      ingredients: rows[0].ingredients || [],
      steps: rows[0].steps || [],
    }, portions, texture)

    const ingredients = (typeof rows[0].ingredients === 'string'
      ? JSON.parse(rows[0].ingredients)
      : rows[0].ingredients) || []
    const costPerServing = parseFloat(rows[0].cost_per_serving || 0)
    const catalog = await fetchVendorCatalog(pool)

    res.json({
      ...batch,
      cost: {
        costPerServing,
        batchCost: Math.round(costPerServing * portions * 10000) / 10000,
        portions,
        costProvenance: RecipeCostingEngine.ingredientProvenance(ingredients, catalog) as CostProvenance,
      },
    })
  } catch (err) { next(err) }
})

/**
 * POST /api/recipes/analyze-nutrition
 * Instant preview calculation of any ingredient list
 */
recipesRouter.post('/analyze-nutrition', requireCapability('recipes.read'), (req: Request, res: Response) => {
  try {
    const { ingredients = [], baseServings = 1 } = req.body
    const analysis = DietaryNutritionalEngine.calculateRecipeNutrition(ingredients, baseServings)
    res.json(analysis)
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Nutrient calculation failed' })
  }
})
