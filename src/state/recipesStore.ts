import { create } from 'zustand'
import type { Recipe } from '@/types/recipe'
import { recipesApi } from '@/api/recipes'

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
    try {
      const recipes = await recipesApi.getAll()
      set({ recipes, loading: false })
    } catch (e: any) {
      set({ error: e?.response?.data?.error ?? e?.message ?? 'Failed to load recipes.', loading: false })
    }
  },

  add: async (data) => {
    const recipe = await recipesApi.create(data)
    set({ recipes: [...get().recipes, recipe] })
  },

  update: async (id, data) => {
    const updated = await recipesApi.update(id, data)
    set({ recipes: get().recipes.map(r => r.id === id ? updated : r) })
  },

  remove: async (id) => {
    await recipesApi.delete(id)
    set({ recipes: get().recipes.filter(r => r.id !== id) })
  },
}))
