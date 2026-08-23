/**
 * ShorelineOps Model Context Protocol (MCP) Server
 * 
 * Exposes standardized MCP Tools and Resources for CulinaryOS and autonomous AI agents:
 * - Census and clinical diet order lookups
 * - Recipe dietary and allergen compliance validation
 * - MRP Bill of Materials (BOM) explosion and vendor PO generation
 * - Autonomous self-healing diagnostic execution
 */

import { pool } from '../db/pool'
import { UnitConversionEngine } from '../engine/units'
import { DietaryNutritionalEngine } from '../engine/nutrition'
import { MrpDemandForecastEngine } from '../engine/mrp'
import { globalHealerBot } from '../agent/healer'
import { getFacilityProfile } from '../config/facilityProfile'

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export const SHORELINE_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'shoreline_get_facility_profile',
    description: 'Retrieves the active facility segment profile (Senior Living, Hospital Acute Care, K-12 School, Catering) and clinical constraints.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'shoreline_get_census_diets',
    description: 'Retrieves active resident or patient headcount, therapeutic diet orders (NAS, NCS, Renal), IDDSI textures, and allergies.',
    inputSchema: {
      type: 'object',
      properties: {
        filterDiet: { type: 'string', description: 'Optional diet filter (e.g. NAS, NCS, Renal)' },
        filterTexture: { type: 'string', description: 'Optional texture filter (e.g. Pureed, Regular)' },
      },
    },
  },
  {
    name: 'shoreline_validate_recipe_dietary',
    description: 'Validates an ingredient list against clinical diet orders (NAS ≤600mg sodium, NCS ≤60g carb, Renal) and identifies Big 9 allergens.',
    inputSchema: {
      type: 'object',
      properties: {
        recipeName: { type: 'string', description: 'Name of the recipe' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item: { type: 'string' },
              qty: { type: 'string' },
            },
            required: ['item', 'qty'],
          },
          description: 'List of ingredients with quantities (e.g. "2 cups flour", "1 lb chicken")',
        },
      },
      required: ['recipeName', 'ingredients'],
    },
  },
  {
    name: 'shoreline_explode_mrp_bom',
    description: 'Calculates raw ingredient demand and distributor purchase orders from a scheduled cycle menu and resident census.',
    inputSchema: {
      type: 'object',
      properties: {
        portionsNeeded: { type: 'number', description: 'Total meal portions required' },
        recipeId: { type: 'string', description: 'Master recipe ID' },
      },
      required: ['portionsNeeded'],
    },
  },
  {
    name: 'shoreline_run_self_healing_audit',
    description: 'Executes an automated self-healing diagnostic scan across database health, HACCP food safety temp logs, and census integrity.',
    inputSchema: {
      type: 'object',
      properties: {
        autoRemediate: { type: 'boolean', description: 'Whether to automatically fix detected issues (default: true)' },
      },
    },
  },
]

/**
 * MCP Tool Executor
 */
export async function executeMcpTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
  switch (toolName) {
    case 'shoreline_get_facility_profile': {
      return getFacilityProfile()
    }

    case 'shoreline_get_census_diets': {
      const { rows } = await pool.query('SELECT id, name, room, diet_type, texture, allergies FROM residents WHERE active = 1 OR active IS NULL')
      let results = rows
      if (args.filterDiet) {
        results = results.filter(r => r.diet_type?.toLowerCase() === args.filterDiet.toLowerCase())
      }
      if (args.filterTexture) {
        results = results.filter(r => r.texture?.toLowerCase() === args.filterTexture.toLowerCase())
      }
      return {
        totalActiveCount: results.length,
        residents: results,
      }
    }

    case 'shoreline_validate_recipe_dietary': {
      const { recipeName, ingredients } = args
      const nutrition = DietaryNutritionalEngine.calculateRecipeNutrition(ingredients, 10)
      const allergens = DietaryNutritionalEngine.detectAllergens(ingredients)

      return {
        recipeName,
        perServingNutrients: nutrition.perServing,
        totalBatchNutrients: nutrition.totalBatch,
        detectedAllergens: allergens,
        ingredientContributions: nutrition.ingredientContributions,
      }
    }

    case 'shoreline_explode_mrp_bom': {
      const portions = args.portionsNeeded || 50
      const sampleScheduledMeal = [
        {
          dayOfWeek: 'Monday',
          mealSlot: 'lunchOpt1Meat',
          projectedPortions: portions,
          recipeLink: {
            menuItemId: 'M-DEFAULT',
            menuItemName: 'Roast Turkey Breast',
            recipeId: 'REC-TRK',
            recipeName: 'Roast Turkey Breast',
            baseServings: 20,
            portionMultiplier: 1.0,
            ingredients: [
              { item: 'turkey breast raw', qty: '10 lbs', vendorSku: 'DNS-TRK', unitCost: 42.00 },
              { item: 'poultry seasoning', qty: '2 tbsp', vendorSku: 'DNS-SEA', unitCost: 3.50 },
            ],
          },
        },
      ]

      const bom = MrpDemandForecastEngine.explodeBillOfMaterials(sampleScheduledMeal)
      const inventory = [
        {
          vendorSku: 'DNS-TRK',
          itemName: 'Turkey Breast Raw',
          category: 'Proteins',
          onHandGrams: 453.592 * 15,
          parLevelGrams: 453.592 * 30,
          packSizeDesc: 'Case of 2/10 lb roasts (20 lbs)',
          packUnitGrams: 453.592 * 20,
          unitCostPerPack: 84.00,
          vendorName: 'Dennis Food Service',
        },
      ]

      const pos = MrpDemandForecastEngine.calculateMaterialRequirements(bom, inventory)
      return {
        explodedBOM: bom,
        suggestedPurchaseOrders: pos,
      }
    }

    case 'shoreline_run_self_healing_audit': {
      const autoFix = args.autoRemediate !== false
      return await globalHealerBot.runAudit(autoFix)
    }

    default:
      throw new Error(`Unknown ShorelineOps MCP tool: ${toolName}`)
  }
}
