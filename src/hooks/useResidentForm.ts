import { useState } from 'react'
import type { Resident } from '@/types/resident'

export type ResidentFormValues = Omit<Resident, 'id'>

const DEFAULT_VALUES: ResidentFormValues = {
  name: '',
  room: '',
  status: 'Active',
  dietType: 'Regular',
  texture: 'Regular',
  portionSize: 'Regular',
  ensurePerDay: 0,
  allergies: [],
  beverages: [],
  birthdayMonth: '',
  birthdayDay: null,
  servingLocation: 'Dining Room',
  tableAssignment: '',
  likes: '',
  dislikes: '',
  specialInstructions: '',
}

export function useResidentForm(initial?: Partial<ResidentFormValues>) {
  const [values, setValues] = useState<ResidentFormValues>({
    ...DEFAULT_VALUES,
    ...initial,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ResidentFormValues, string>>>({})

  function set<K extends keyof ResidentFormValues>(key: K, value: ResidentFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleArrayItem(key: 'allergies' | 'beverages', item: string) {
    const arr = values[key] as string[]
    const next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]
    set(key, next)
  }

  function validate(): boolean {
    const next: typeof errors = {}
    if (!values.name.trim()) next.name = 'Name is required'
    if (!values.birthdayMonth) next.birthdayMonth = 'Birth month is required'
    if (!values.room.trim()) next.room = 'Room is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function reset(newInitial?: Partial<ResidentFormValues>) {
    setValues({ ...DEFAULT_VALUES, ...newInitial })
    setErrors({})
  }

  return { values, errors, set, toggleArrayItem, validate, reset }
}
