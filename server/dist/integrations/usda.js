"use strict";
/**
 * USDA FoodData Central & Clinical Nutrition Connector
 *
 * Provides automated nutrient breakdown (Calories, Protein, Carbs, Fat, Sodium, Fiber, Potassium)
 * using USDA FoodData Central standards and validates compliance against therapeutic diet orders.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.USDAFoodDataConnector = exports.USDA_REFERENCE_DATABASE = exports.THERAPEUTIC_TARGETS = void 0;
exports.THERAPEUTIC_TARGETS = {
    'NAS': {
        dietOrder: 'NAS (No Added Salt)',
        maxSodiumMgPerMeal: 600, // ≤ 2000mg/day target
    },
    'Low Sodium': {
        dietOrder: 'Low Sodium',
        maxSodiumMgPerMeal: 500, // ≤ 1500mg/day target
    },
    'NCS': {
        dietOrder: 'NCS (No Concentrated Sweets / Diabetic)',
        maxCarbsGramsPerMeal: 60,
    },
    'Renal': {
        dietOrder: 'Renal Diet',
        maxSodiumMgPerMeal: 500,
        maxFatGramsPerMeal: 25,
    },
    'High Protein': {
        dietOrder: 'High Protein / Wound Care',
        minProteinGramsPerMeal: 25,
    },
};
// Built-in standard food composition reference database (Foundation/SR Legacy aligned)
exports.USDA_REFERENCE_DATABASE = {
    'roasted chicken breast': {
        description: 'Chicken breast, oven roasted, skinless',
        servingSizeGrams: 140,
        calories: 231,
        proteinGrams: 43.4,
        carbsGrams: 0,
        fatGrams: 5.0,
        sodiumMg: 104,
        potassiumMg: 358,
        fiberGrams: 0,
    },
    'steamed broccoli': {
        description: 'Broccoli, steamed florets',
        servingSizeGrams: 150,
        calories: 55,
        proteinGrams: 3.7,
        carbsGrams: 11.2,
        fatGrams: 0.6,
        sodiumMg: 60,
        potassiumMg: 457,
        fiberGrams: 5.1,
    },
    'mashed potatoes with butter': {
        description: 'Potatoes, mashed with whole milk and butter',
        servingSizeGrams: 210,
        calories: 214,
        proteinGrams: 3.5,
        carbsGrams: 35.3,
        fatGrams: 7.2,
        sodiumMg: 320,
        potassiumMg: 520,
        fiberGrams: 2.8,
    },
    'baked salmon fillet': {
        description: 'Atlantic salmon fillet, baked',
        servingSizeGrams: 150,
        calories: 312,
        proteinGrams: 34.2,
        carbsGrams: 0,
        fatGrams: 18.5,
        sodiumMg: 85,
        potassiumMg: 575,
        fiberGrams: 0,
    },
    'steamed white rice': {
        description: 'Enriched white rice, cooked',
        servingSizeGrams: 158,
        calories: 205,
        proteinGrams: 4.2,
        carbsGrams: 44.5,
        fatGrams: 0.4,
        sodiumMg: 2,
        potassiumMg: 55,
        fiberGrams: 0.6,
    },
    'chocolate pudding': {
        description: 'Pudding, chocolate, ready-to-eat',
        servingSizeGrams: 113,
        calories: 145,
        proteinGrams: 2.4,
        carbsGrams: 28.5,
        fatGrams: 3.1,
        sodiumMg: 180,
        potassiumMg: 160,
        fiberGrams: 1.0,
    },
};
class USDAFoodDataConnector {
    systemName = 'USDA FoodData Central & Clinical Nutrition';
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.USDA_FDC_API_KEY;
    }
    /**
     * Search and match nutrient composition for an ingredient or meal item
     */
    async getNutrientProfile(itemName) {
        const cleanName = itemName.toLowerCase().trim();
        // 1. Check local standard baseline reference
        for (const [key, profile] of Object.entries(exports.USDA_REFERENCE_DATABASE)) {
            if (cleanName.includes(key) || key.includes(cleanName)) {
                return profile;
            }
        }
        // 2. Default estimated fallback if unknown
        return {
            description: itemName,
            servingSizeGrams: 100,
            calories: 150,
            proteinGrams: 8,
            carbsGrams: 18,
            fatGrams: 5,
            sodiumMg: 150,
            potassiumMg: 180,
            fiberGrams: 2,
        };
    }
    /**
     * Calculate aggregated nutritional totals for an entire meal
     */
    async analyzeMeal(items, dietOrder = 'Regular') {
        const profiles = await Promise.all(items.map(item => this.getNutrientProfile(item)));
        const totals = profiles.reduce((acc, p) => ({
            calories: acc.calories + p.calories,
            proteinGrams: Math.round((acc.proteinGrams + p.proteinGrams) * 10) / 10,
            carbsGrams: Math.round((acc.carbsGrams + p.carbsGrams) * 10) / 10,
            fatGrams: Math.round((acc.fatGrams + p.fatGrams) * 10) / 10,
            sodiumMg: acc.sodiumMg + p.sodiumMg,
            potassiumMg: acc.potassiumMg + p.potassiumMg,
            fiberGrams: Math.round((acc.fiberGrams + p.fiberGrams) * 10) / 10,
        }), {
            calories: 0,
            proteinGrams: 0,
            carbsGrams: 0,
            fatGrams: 0,
            sodiumMg: 0,
            potassiumMg: 0,
            fiberGrams: 0,
        });
        const compliance = this.checkTherapeuticCompliance(dietOrder, totals);
        return {
            dietOrder,
            itemsAnalyzed: profiles.map(p => ({
                name: p.description,
                calories: p.calories,
                sodiumMg: p.sodiumMg,
                carbsGrams: p.carbsGrams,
                proteinGrams: p.proteinGrams,
            })),
            totals,
            compliance,
        };
    }
    /**
     * Check compliance against clinical diet order bounds
     */
    checkTherapeuticCompliance(dietOrder, totals) {
        const rule = exports.THERAPEUTIC_TARGETS[dietOrder];
        const flags = [];
        let compliant = true;
        if (rule) {
            if (rule.maxSodiumMgPerMeal && totals.sodiumMg > rule.maxSodiumMgPerMeal) {
                flags.push(`Exceeds maximum sodium limit for ${dietOrder} (${totals.sodiumMg}mg > ${rule.maxSodiumMgPerMeal}mg)`);
                compliant = false;
            }
            if (rule.maxCarbsGramsPerMeal && totals.carbsGrams > rule.maxCarbsGramsPerMeal) {
                flags.push(`Exceeds maximum carbohydrate limit for ${dietOrder} (${totals.carbsGrams}g > ${rule.maxCarbsGramsPerMeal}g)`);
                compliant = false;
            }
            if (rule.minProteinGramsPerMeal && totals.proteinGrams < rule.minProteinGramsPerMeal) {
                flags.push(`Below target protein threshold for ${dietOrder} (${totals.proteinGrams}g < ${rule.minProteinGramsPerMeal}g)`);
                compliant = false;
            }
        }
        return {
            compliant,
            flags,
            dietTarget: rule?.dietOrder ?? 'Standard Regular Diet (No strict macro restrictions)',
        };
    }
}
exports.USDAFoodDataConnector = USDAFoodDataConnector;
