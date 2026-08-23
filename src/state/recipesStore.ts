import { create } from 'zustand'
import type { Recipe } from '@/types/recipe'
import { SEED_RECIPES, uid, now } from '@/demo/seed'
import { recipesApi } from '@/api/recipes'

let _recipes: Recipe[] = JSON.parse(JSON.stringify(SEED_RECIPES))

type RecipesState = {
  recipes: Recipe[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  add: (data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  update: (id: string, data: Partial<Recipe>) => Promise<void>
  remove: (id: string) => Promise<void>
  scaleRecipe: (id: string, portions: number, texture?: string) => Promise<any>
}

export const useRecipesStore = create<RecipesState>((set, get) => ({
  recipes: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await recipesApi.getAll()
      if (Array.isArray(data) && data.length > 0) {
        set({ recipes: data, loading: false })
        return
      }
    } catch {
      // Fall back to seed recipes if offline/demo
    }
    set({ recipes: [..._recipes], loading: false })
  },

  add: async (data) => {
    try {
      const created = await recipesApi.create(data)
      set(state => ({ recipes: [created, ...state.recipes] }))
      return
    } catch {
      const recipe: Recipe = { ...data, id: uid(), createdAt: now(), updatedAt: now() }
      _recipes = [recipe, ..._recipes]
      set({ recipes: [..._recipes] })
    }
  },

  update: async (id, data) => {
    try {
      const updated = await recipesApi.update(id, data)
      set(state => ({ recipes: state.recipes.map(r => r.id === id ? updated : r) }))
      return
    } catch {
      _recipes = _recipes.map(r => r.id === id ? { ...r, ...data, updatedAt: now() } : r)
      set({ recipes: [..._recipes] })
    }
  },

  remove: async (id) => {
    try {
      await recipesApi.delete(id)
      set(state => ({ recipes: state.recipes.filter(r => r.id !== id) }))
      return
    } catch {
      _recipes = _recipes.filter(r => r.id !== id)
      set({ recipes: [..._recipes] })
    }
  },

  scaleRecipe: async (id, portions, texture = 'Regular') => {
    // Client-side instant scaling fallback
    const recipe = get().recipes.find(r => r.id === id)
    if (!recipe) return null
    const factor = portions / (recipe.baseServings || 1)
    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      targetPortions: portions,
      scaleFactor: factor,
      scaledIngredients: recipe.ingredients.map(ing => ({
        item: ing.item,
        baseQty: ing.qty,
        scaledQty: `${ing.qty} (x${factor.toFixed(2)})`,
        vendorSku: ing.vendorItemSku,
      })),
    }
  },
}))
