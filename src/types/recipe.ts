export const RECIPE_CATEGORIES = [
  'Cookies', 'Muffins', 'Snacks', 'Desserts', 'Proteins', 'Starches', 'Veggies',
  'Breakfast', 'Soups', 'Beverages', 'Other',
] as const
export type RecipeCategory = typeof RECIPE_CATEGORIES[number]

export const RECIPE_ALLERGENS = [
  'Gluten', 'Dairy', 'Nuts', 'Eggs', 'Soy', 'Seeds',
] as const
export type RecipeAllergen = typeof RECIPE_ALLERGENS[number]

export type RecipeIngredient = {
  qty: string             // e.g. "1 cup", "2 tbsp", "4 lbs"
  item: string            // e.g. "applesauce", "chicken breast"
  vendorItemSku?: string  // e.g. "DNS-1004" (Dennis Food Service SKU)
  estimatedCost?: number  // e.g. 4.25
  allergens?: RecipeAllergen[]
}

export type RecipeStep = {
  step: number
  instruction: string
}

export type Recipe = {
  id: string
  name: string
  category: RecipeCategory
  allergens: RecipeAllergen[]
  baseServings: number          // original yield
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  notes: string
  costPerServing?: number       // auto-computed from linked vendor SKUs
  createdAt?: string
  updatedAt?: string
}
