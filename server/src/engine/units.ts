/**
 * Unit Conversion & Culinary Measurement Matrix Engine
 * 
 * Provides precise conversions across:
 * 1. Mass (grams, kilograms, ounces, pounds)
 * 2. Volume (milliliters, liters, teaspoons, tablespoons, fluid ounces, cups, pints, quarts, gallons)
 * 3. Foodservice counts (#10 cans, cases, bags, packs, bunches, slices, each)
 * 4. Density-based conversions (converting volume to mass using standard ingredient densities)
 */

export type MassUnit = 'g' | 'kg' | 'oz' | 'lb'
export type VolumeUnit = 'ml' | 'l' | 'tsp' | 'tbsp' | 'fl oz' | 'cup' | 'pt' | 'qt' | 'gal'
export type CountUnit = 'each' | 'slice' | 'can' | '#10 can' | 'case' | 'pack' | 'bag' | 'bunch' | 'portion'
export type CulinaryUnit = MassUnit | VolumeUnit | CountUnit

// Mass in grams
export const MASS_TO_GRAMS: Record<MassUnit, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
}

// Volume in milliliters
export const VOLUME_TO_ML: Record<VolumeUnit, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  'fl oz': 29.5735,
  cup: 236.588,
  pt: 473.176,
  qt: 946.353,
  gal: 3785.41,
}

// Standard Foodservice counts in grams (approximate standard institutional weights)
export const COUNT_TO_GRAMS_DEFAULT: Partial<Record<CountUnit, number>> = {
  '#10 can': 2948.35, // ~104 oz / 6.5 lbs
  can: 425.24,        // ~15 oz standard #300/#303 can
  slice: 28.35,       // ~1 oz
  portion: 120,       // ~4 oz standard protein/starch serving
}

// Standard ingredient densities in g/ml for Volume-to-Mass conversions
export const INGREDIENT_DENSITIES: Record<string, number> = {
  water: 1.0,
  milk: 1.03,
  oil: 0.92,
  honey: 1.42,
  flour: 0.53,       // ~125g per cup (236.5ml)
  sugar: 0.85,       // ~200g per cup
  brown_sugar: 0.93, // ~220g per cup
  butter: 0.96,      // ~227g per cup (2 sticks)
  rice: 0.85,        // ~200g per cup raw
  oats: 0.38,        // ~90g per cup rolled oats
  puree: 1.05,
}

export class UnitConversionEngine {
  /**
   * Parse a raw quantity string like "1.5 lbs", "2 1/2 cups", "3 cans", "400 g"
   */
  static parseQuantityString(raw: string): { amount: number; unit: string } {
    const trimmed = raw.trim()
    
    // Handle mixed numbers like "2 1/2" or "1 3/4"
    const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/)
    if (mixedMatch) {
      const whole = parseFloat(mixedMatch[1])
      const num = parseFloat(mixedMatch[2])
      const den = parseFloat(mixedMatch[3])
      return {
        amount: whole + (num / den),
        unit: mixedMatch[4].trim().toLowerCase() || 'each',
      }
    }

    // Handle simple fraction like "1/2"
    const fracMatch = trimmed.match(/^(\d+)\/(\d+)\s*(.*)$/)
    if (fracMatch) {
      return {
        amount: parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]),
        unit: fracMatch[3].trim().toLowerCase() || 'each',
      }
    }

    // Handle decimal or integer with unit
    const standardMatch = trimmed.match(/^([\d.]+)\s*(.*)$/)
    if (standardMatch) {
      return {
        amount: parseFloat(standardMatch[1]),
        unit: standardMatch[2].trim().toLowerCase() || 'each',
      }
    }

    return { amount: 1, unit: trimmed.toLowerCase() || 'each' }
  }

  /**
   * Normalize any recognized unit string to standard abbreviation
   */
  static normalizeUnit(unit: string): CulinaryUnit {
    const u = unit.toLowerCase().trim()
    if (['g', 'gram', 'grams'].includes(u)) return 'g'
    if (['kg', 'kilogram', 'kilograms'].includes(u)) return 'kg'
    if (['oz', 'ounce', 'ounces'].includes(u)) return 'oz'
    if (['lb', 'lbs', 'pound', 'pounds'].includes(u)) return 'lb'
    if (['ml', 'milliliter', 'milliliters'].includes(u)) return 'ml'
    if (['l', 'liter', 'liters'].includes(u)) return 'l'
    if (['tsp', 'teaspoon', 'teaspoons'].includes(u)) return 'tsp'
    if (['tbsp', 'tablespoon', 'tablespoons', 'tbs'].includes(u)) return 'tbsp'
    if (['fl oz', 'floz', 'fluid ounce', 'fluid ounces'].includes(u)) return 'fl oz'
    if (['cup', 'cups', 'c'].includes(u)) return 'cup'
    if (['pt', 'pint', 'pints'].includes(u)) return 'pt'
    if (['qt', 'quart', 'quarts'].includes(u)) return 'qt'
    if (['gal', 'gallon', 'gallons'].includes(u)) return 'gal'
    if (['#10', '#10 can', '#10 cans', '10 can'].includes(u)) return '#10 can'
    if (['can', 'cans'].includes(u)) return 'can'
    if (['case', 'cases', 'cs'].includes(u)) return 'case'
    if (['pack', 'packs', 'pk'].includes(u)) return 'pack'
    if (['bag', 'bags'].includes(u)) return 'bag'
    if (['bunch', 'bunches'].includes(u)) return 'bunch'
    if (['slice', 'slices'].includes(u)) return 'slice'
    if (['portion', 'portions', 'serving', 'servings'].includes(u)) return 'portion'
    return 'each'
  }

  /**
   * Convert any quantity between compatible units
   */
  static convert(
    amount: number,
    fromUnit: string,
    toUnit: string,
    ingredientName?: string
  ): { convertedAmount: number; unit: CulinaryUnit } {
    const from = this.normalizeUnit(fromUnit)
    const to = this.normalizeUnit(toUnit)

    if (from === to) return { convertedAmount: amount, unit: to }

    // 1. Mass to Mass
    if (from in MASS_TO_GRAMS && to in MASS_TO_GRAMS) {
      const grams = amount * MASS_TO_GRAMS[from as MassUnit]
      const result = grams / MASS_TO_GRAMS[to as MassUnit]
      return { convertedAmount: Math.round(result * 1000) / 1000, unit: to }
    }

    // 2. Volume to Volume
    if (from in VOLUME_TO_ML && to in VOLUME_TO_ML) {
      const ml = amount * VOLUME_TO_ML[from as VolumeUnit]
      const result = ml / VOLUME_TO_ML[to as VolumeUnit]
      return { convertedAmount: Math.round(result * 1000) / 1000, unit: to }
    }

    // 3. Density lookup for Volume <-> Mass conversions
    const density = this.getDensity(ingredientName)

    if (from in VOLUME_TO_ML && to in MASS_TO_GRAMS) {
      const ml = amount * VOLUME_TO_ML[from as VolumeUnit]
      const grams = ml * density
      const result = grams / MASS_TO_GRAMS[to as MassUnit]
      return { convertedAmount: Math.round(result * 1000) / 1000, unit: to }
    }

    if (from in MASS_TO_GRAMS && to in VOLUME_TO_ML) {
      const grams = amount * MASS_TO_GRAMS[from as MassUnit]
      const ml = grams / density
      const result = ml / VOLUME_TO_ML[to as VolumeUnit]
      return { convertedAmount: Math.round(result * 1000) / 1000, unit: to }
    }

    // 4. Foodservice Count conversions
    if (from === '#10 can' && to in MASS_TO_GRAMS) {
      const grams = amount * (COUNT_TO_GRAMS_DEFAULT['#10 can'] ?? 2948.35)
      return { convertedAmount: grams / MASS_TO_GRAMS[to as MassUnit], unit: to }
    }

    if (from in MASS_TO_GRAMS && to === '#10 can') {
      const grams = amount * MASS_TO_GRAMS[from as MassUnit]
      const cans = grams / (COUNT_TO_GRAMS_DEFAULT['#10 can'] ?? 2948.35)
      return { convertedAmount: Math.round(cans * 100) / 100, unit: to }
    }

    // Fallback: 1-to-1 ratio
    return { convertedAmount: amount, unit: to }
  }

  /**
   * Determine density based on ingredient keyword matching
   */
  static getDensity(ingredientName?: string): number {
    if (!ingredientName) return 1.0
    const lower = ingredientName.toLowerCase()
    for (const [key, density] of Object.entries(INGREDIENT_DENSITIES)) {
      if (lower.includes(key)) return density
    }
    return 1.0
  }
}
