/**
 * Recipes store — DEMO MODE
 * All data lives in memory. Changes persist for the session but reset on reload.
 */
import { create } from 'zustand'
import type { Recipe } from '@/types/recipe'
import { SEED_RECIPES, uid, now } from '@/demo/seed'

let _recipes: Recipe[] = JSON.parse(JSON.stringify(SEED_RECIPES))

type RecipesState = {
  recipes: Recipe[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  add: (data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  update: (id: string, data: Partial<Recipe>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useRecipesStore = create<RecipesState>((set, get) => ({
  recipes: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    await new Promise(r => setTimeout(r, 150))
    set({ recipes: [..._recipes], loading: false })
  },

  add: async (data) => {
    const recipe: Recipe = { ...data, id: uid(), createdAt: now(), updatedAt: now() }
    _recipes = [..._recipes, recipe]
    set({ recipes: [..._recipes] })
  },

  update: async (id, data) => {
    _recipes = _recipes.map(r => r.id === id ? { ...r, ...data, updatedAt: now() } : r)
    set({ recipes: [..._recipes] })
  },

  remove: async (id) => {
    _recipes = _recipes.filter(r => r.id !== id)
    set({ recipes: [..._recipes] })
  },
}))
