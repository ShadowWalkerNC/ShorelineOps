import { api } from './client'
import type { Recipe } from '@/types/recipe'

export const recipesApi = {
  getAll: async (): Promise<Recipe[]> => {
    const { data } = await api.get<Recipe[]>('/recipes')
    return data
  },

  getById: async (id: string): Promise<Recipe> => {
    const { data } = await api.get<Recipe>(`/recipes/${id}`)
    return data
  },

  create: async (payload: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe> => {
    const { data } = await api.post<Recipe>('/recipes', payload)
    return data
  },

  update: async (id: string, payload: Partial<Recipe>): Promise<Recipe> => {
    const { data } = await api.put<Recipe>(`/recipes/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/recipes/${id}`)
  },

  verifyClinical: async (
    id: string,
    payload: { approvedDiets?: string[]; fluidMlPerServing?: number | null; canonicalAllergens?: string[] }
  ): Promise<Partial<Recipe>> => {
    const { data } = await api.post<Partial<Recipe>>(`/recipes/${id}/verify-clinical`, payload)
    return data
  },
}

