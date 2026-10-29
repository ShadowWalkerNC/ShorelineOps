/**
 * Shared TV wall-display data helpers: last-good snapshot cache, menu
 * projection (Choice A/B model), meal countdown, and a ticking clock.
 */
import { useEffect, useState } from 'react'
import type { DayOfWeek, MenuItem, MenuWeek } from '@/types/menu'

export const DAY_NAMES: DayOfWeek[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

export function todayName(d = new Date()): DayOfWeek {
  return DAY_NAMES[d.getDay()]
}

export function tomorrowName(d = new Date()): DayOfWeek {
  return DAY_NAMES[(d.getDay() + 1) % 7]
}

// ── Meal times (TV-local; each wall follows its dining room) ─────────────────

export interface TvMealTimes {
  breakfast: string
  lunch: string
  dinner: string
}

export const DEFAULT_TV_MEAL_TIMES: TvMealTimes = {
  breakfast: '07:30',
  lunch: '12:00',
  dinner: '17:30',
}

const MEAL_TIMES_KEY = 'shoreline:tv-meal-times'
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function cleanTime(value: unknown, fallback: string): string {
  return typeof value === 'string' && TIME_RE.test(value.trim()) ? value.trim() : fallback
}

export function loadTvMealTimes(): TvMealTimes {
  try {
    const raw = localStorage.getItem(MEAL_TIMES_KEY)
    if (!raw) return { ...DEFAULT_TV_MEAL_TIMES }
    const parsed = JSON.parse(raw) as Partial<TvMealTimes>
    return {
      breakfast: cleanTime(parsed.breakfast, DEFAULT_TV_MEAL_TIMES.breakfast),
      lunch: cleanTime(parsed.lunch, DEFAULT_TV_MEAL_TIMES.lunch),
      dinner: cleanTime(parsed.dinner, DEFAULT_TV_MEAL_TIMES.dinner),
    }
  } catch {
    return { ...DEFAULT_TV_MEAL_TIMES }
  }
}

export function saveTvMealTimes(times: TvMealTimes): void {
  try {
    localStorage.setItem(
      MEAL_TIMES_KEY,
      JSON.stringify({
        breakfast: cleanTime(times.breakfast, DEFAULT_TV_MEAL_TIMES.breakfast),
        lunch: cleanTime(times.lunch, DEFAULT_TV_MEAL_TIMES.lunch),
        dinner: cleanTime(times.dinner, DEFAULT_TV_MEAL_TIMES.dinner),
      })
    )
  } catch {
    /* private-mode WebView: keep defaults for this session */
  }
}

// ── Last-good snapshot cache (survives network blips) ───────────────────────

export interface TvSnapshot<T> {
  data: T
  fetchedAt: string
}

export function saveSnapshot(key: string, data: unknown): void {
  try {
    const snapshot: TvSnapshot<unknown> = { data, fetchedAt: new Date().toISOString() }
    localStorage.setItem(key, JSON.stringify(snapshot))
  } catch {
    /* cache is best-effort */
  }
}

export function loadSnapshot<T>(key: string): TvSnapshot<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TvSnapshot<T>
    if (!parsed || typeof parsed.fetchedAt !== 'string' || !('data' in parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function ageLabel(fetchedAt: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(fetchedAt).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  return hours === 1 ? '1 hr ago' : `${hours} hrs ago`
}

// ── Menu projection (Choice A/B: Opt1/Opt2 meat + veggie + starch) ───────────

export interface TvMealOption {
  meat: string[]
  veggie: string[]
  starch: string[]
}

export interface TvDayMenu {
  weekName: string
  breakfast: string[]
  lunchA: TvMealOption
  lunchB: TvMealOption
  lunchDessert: string[]
  dinnerA: TvMealOption
  dinnerB: TvMealOption
  dinnerDessert: string[]
  hasAnyItems: boolean
}

export function projectDayMenu(
  week: MenuWeek | null,
  items: MenuItem[],
  day: DayOfWeek
): TvDayMenu | null {
  if (!week) return null
  const byId = new Map(items.map(i => [i.id, i.name]))
  const names = (ids: unknown): string[] =>
    (Array.isArray(ids) ? ids : [])
      .map(id => (typeof id === 'string' ? byId.get(id) : undefined))
      .filter((n): n is string => !!n)
  const dayMenu = (week.days as Record<string, Record<string, { itemIds?: unknown }>>)[day] ?? {}
  const slot = (key: string): string[] => names(dayMenu[key]?.itemIds)
  const option = (prefix: string): TvMealOption => ({
    meat: slot(`${prefix}Meat`),
    veggie: slot(`${prefix}Veggie`),
    starch: slot(`${prefix}Starch`),
  })
  const menu: TvDayMenu = {
    weekName: week.name,
    breakfast: slot('breakfast'),
    lunchA: option('lunchOpt1'),
    lunchB: option('lunchOpt2'),
    lunchDessert: slot('lunchDessert'),
    dinnerA: option('dinnerOpt1'),
    dinnerB: option('dinnerOpt2'),
    dinnerDessert: slot('dinnerDessert'),
    hasAnyItems: false,
  }
  const count = (o: TvMealOption) => o.meat.length + o.veggie.length + o.starch.length
  menu.hasAnyItems =
    menu.breakfast.length + count(menu.lunchA) + count(menu.lunchB) +
      menu.lunchDessert.length + count(menu.dinnerA) + count(menu.dinnerB) +
      menu.dinnerDessert.length > 0
  return menu
}

export function optionIsEmpty(o: TvMealOption): boolean {
  return o.meat.length + o.veggie.length + o.starch.length === 0
}

// ── Countdown ────────────────────────────────────────────────────────────────

export type TvMealKey = 'breakfast' | 'lunch' | 'dinner'

const MEAL_LABELS: Record<TvMealKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

/** Next upcoming meal from the TV-local schedule (rolls to tomorrow's breakfast). */
export function nextMeal(times: TvMealTimes, now = new Date()): { key: TvMealKey; label: string; at: Date } {
  const order: TvMealKey[] = ['breakfast', 'lunch', 'dinner']
  for (const key of order) {
    const [h, m] = times[key].split(':').map(Number)
    const at = new Date(now)
    at.setHours(h, m, 0, 0)
    if (at.getTime() > now.getTime()) return { key, label: MEAL_LABELS[key], at }
  }
  const [h, m] = times.breakfast.split(':').map(Number)
  const at = new Date(now)
  at.setDate(at.getDate() + 1)
  at.setHours(h, m, 0, 0)
  return { key: 'breakfast', label: `${MEAL_LABELS.breakfast} (tomorrow)`, at }
}

export function formatCountdown(target: Date, now = new Date()): string {
  const mins = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000))
  if (mins < 1) return 'starting now'
  if (mins < 60) return `in ${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest === 0 ? `in ${hours} hr` : `in ${hours} hr ${rest} min`
}

/** Meal currently on the pass (most recent start time), for board highlighting. */
export function currentMeal(times: TvMealTimes, now = new Date()): TvMealKey {
  const order: TvMealKey[] = ['dinner', 'lunch', 'breakfast']
  for (const key of order) {
    const [h, m] = times[key].split(':').map(Number)
    const at = new Date(now)
    at.setHours(h, m, 0, 0)
    if (now.getTime() >= at.getTime()) return key
  }
  return 'breakfast'
}

// ── Clock ────────────────────────────────────────────────────────────────────

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function formatClock(now: Date): string {
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatToday(now: Date): string {
  return now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}
