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
  qty: string      // e.g. "1 cup", "2 tbsp"
  item: string     // e.g. "applesauce"
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
  createdAt?: string
  updatedAt?: string
}
