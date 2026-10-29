/**
 * TV menu board: today's breakfast, lunch (Choice A/B + dessert), and dinner
 * (Choice A/B + dessert) with a meal countdown. Auto-refreshes; falls back
 * to the last-good snapshot with an honest stale banner when offline.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { menuApi } from '@/api/menu'
import type { MenuItem, MenuWeek } from '@/types/menu'
import {
  ageLabel,
  currentMeal,
  formatToday,
  loadSnapshot,
  loadTvMealTimes,
  nextMeal,
  formatCountdown,
  optionIsEmpty,
  projectDayMenu,
  saveSnapshot,
  todayName,
  tomorrowName,
  useNow,
  DAY_NAMES,
  type TvDayMenu,
  type TvMealOption,
  type TvMealTimes,
} from './tvData'
import './tv.css'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const SNAPSHOT_KEY = 'shoreline:tv-menu-snapshot'
const REFRESH_MS = 60000

interface MenuSnapshot {
  week: MenuWeek | null
  items: MenuItem[]
}

function ChoiceBlock({ label, option }: { label: string; option: TvMealOption }) {
  if (optionIsEmpty(option)) return null
  return (
    <div>
      <p className="tv-choice-label">{label}</p>
      {option.meat.map(name => <p key={name} className="tv-dish">{name}</p>)}
      {option.veggie.map(name => <p key={name} className="tv-dish">{name}</p>)}
      {option.starch.map(name => <p key={name} className="tv-dish">{name}</p>)}
    </div>
  )
}

type MenuView = 'today' | 'tomorrow' | 'week'

const VIEW_LABELS: Record<MenuView, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
}

/** Compact week grid: one card per day, mains only (sides live in day view). */
function WeekView({ week, items, today }: { week: MenuWeek; items: MenuItem[]; today: string }) {
  return (
    <div className="tv-week-grid">
      {DAY_NAMES.map(day => {
        const menu = projectDayMenu(week, items, day)
        const mains = (o: TvMealOption) => o.meat.join(', ') || '—'
        return (
          <section
            key={day}
            className={day === today ? 'tv-day-card tv-day-today' : 'tv-day-card'}
            aria-label={`${day} menu`}
          >
            <h2 className="tv-day-name">
              {day}
              {day === today && <span className="tv-now-flag">Today</span>}
            </h2>
            {!menu || !menu.hasAnyItems ? (
              <p className="tv-empty">No menu posted</p>
            ) : (
              <>
                <p className="tv-day-row">
                  <span className="tv-day-meal">Breakfast</span>
                  {menu.breakfast.join(', ') || '—'}
                </p>
                <p className="tv-day-row">
                  <span className="tv-day-meal">Lunch</span>
                  A: {mains(menu.lunchA)} · B: {mains(menu.lunchB)}
                </p>
                <p className="tv-day-row">
                  <span className="tv-day-meal">Dinner</span>
                  A: {mains(menu.dinnerA)} · B: {mains(menu.dinnerB)}
                </p>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default function TvMenuPage() {
  const [week, setWeek] = useState<MenuWeek | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [weekName, setWeekName] = useState('')
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [times] = useState<TvMealTimes>(loadTvMealTimes)
  const [view, setView] = useState<MenuView>('today')
  const now = useNow(1000)

  const applySnapshot = useCallback((snap: MenuSnapshot, at: string, isStale: boolean) => {
    setWeek(snap.week)
    setItems(snap.items)
    setWeekName(snap.week?.name ?? '')
    setFetchedAt(at)
    setStale(isStale)
    setFatal(null)
  }, [])

  const loadSeeds = useCallback(async (): Promise<boolean> => {
    const { SEED_MENU_WEEKS, SEED_MENU_ITEMS, isDemoSeedAllowed } = await import('@/demo/seed')
    if (!isDemoSeedAllowed()) return false
    const active = SEED_MENU_WEEKS.find(w => w.active) ?? SEED_MENU_WEEKS[0] ?? null
    if (!active) return false
    applySnapshot({ week: active, items: [...SEED_MENU_ITEMS] }, new Date().toISOString(), false)
    return true
  }, [applySnapshot])

  const load = useCallback(async () => {
    if (DEMO_MODE) {
      if (!(await loadSeeds())) setFatal('Demo menu data is unavailable in this build.')
      return
    }
    try {
      const [weeks, library] = await Promise.all([menuApi.getWeeks(), menuApi.getItems()])
      const active = weeks.find(w => w.active) ?? weeks[0] ?? null
      const snap: MenuSnapshot = { week: active, items: library }
      saveSnapshot(SNAPSHOT_KEY, snap)
      applySnapshot(snap, new Date().toISOString(), false)
    } catch {
      const cached = loadSnapshot<MenuSnapshot>(SNAPSHOT_KEY)
      if (cached) {
        applySnapshot(cached.data, cached.fetchedAt, true)
        return
      }
      if (await loadSeeds()) return
      setFatal('Menu unavailable — check the server connection, then re-pair from Setup if needed.')
    }
  }, [applySnapshot, loadSeeds])

  useEffect(() => {
    void load()
    if (DEMO_MODE) return
    const id = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load])

  const day = view === 'tomorrow' ? tomorrowName(now) : todayName(now)
  const menu: TvDayMenu | null = projectDayMenu(week, items, day)
  const current = view === 'today' ? currentMeal(times, now) : null
  const upcoming = nextMeal(times, now)

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') window.scrollBy({ top: 420, behavior: 'smooth' })
    else if (e.key === 'ArrowUp') window.scrollBy({ top: -420, behavior: 'smooth' })
  }, [])

  return (
    <div onKeyDown={onKeyDown}>
      <div className="tv-headline-row">
        <h1 className="tv-date">{view === 'week' ? weekName || 'This week' : formatToday(now)}</h1>
        {view !== 'week' && weekName && <span className="tv-week">{weekName}</span>}
        <div className="tv-view-switch" role="group" aria-label="Menu views">
          {(Object.keys(VIEW_LABELS) as MenuView[]).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={view === v ? 'tv-view-btn tv-view-active' : 'tv-view-btn'}
              aria-pressed={view === v}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <span className="tv-countdown">
          {upcoming.label} {formatCountdown(upcoming.at, now)}
        </span>
      </div>

      {fatal && (
        <div className="tv-panel" role="alert">
          <p className="tv-panel-title">Menu unavailable</p>
          <p className="tv-note">{fatal}</p>
        </div>
      )}

      {!fatal && !week && fetchedAt && (
        <div className="tv-panel">
          <p className="tv-panel-title">No menu published yet</p>
          <p className="tv-note">Publish a cycle menu in the Shoreline web app and this board fills automatically.</p>
        </div>
      )}

      {!fatal && view === 'week' && week && (
        <WeekView week={week} items={items} today={todayName(now)} />
      )}

      {!fatal && view !== 'week' && menu && !menu.hasAnyItems && (
        <div className="tv-panel">
          <p className="tv-panel-title">No menu posted for {day}</p>
          <p className="tv-note">The kitchen has not published this day yet. The board refreshes automatically.</p>
        </div>
      )}

      {!fatal && view !== 'week' && menu && menu.hasAnyItems && (
        <div className="tv-meals">
          <section className={current === 'breakfast' ? 'tv-meal tv-meal-current' : 'tv-meal'} aria-label="Breakfast">
            <div className="tv-meal-head">
              <h2 className="tv-meal-name">Breakfast</h2>
              <span className="tv-meal-time">{times.breakfast}</span>
              {current === 'breakfast' && <span className="tv-now-flag">Now</span>}
            </div>
            {menu.breakfast.length === 0 && <p className="tv-empty">—</p>}
            {menu.breakfast.map(name => <p key={name} className="tv-dish">{name}</p>)}
          </section>

          <section className={current === 'lunch' ? 'tv-meal tv-meal-current' : 'tv-meal'} aria-label="Lunch">
            <div className="tv-meal-head">
              <h2 className="tv-meal-name">Lunch</h2>
              <span className="tv-meal-time">{times.lunch}</span>
              {current === 'lunch' && <span className="tv-now-flag">Now</span>}
            </div>
            <ChoiceBlock label="Choice A" option={menu.lunchA} />
            <ChoiceBlock label="Choice B" option={menu.lunchB} />
            {menu.lunchDessert.length > 0 && (
              <div>
                <p className="tv-dessert-label">Dessert</p>
                {menu.lunchDessert.map(name => <p key={name} className="tv-dish">{name}</p>)}
              </div>
            )}
            {optionIsEmpty(menu.lunchA) && optionIsEmpty(menu.lunchB) && menu.lunchDessert.length === 0 && (
              <p className="tv-empty">—</p>
            )}
          </section>

          <section className={current === 'dinner' ? 'tv-meal tv-meal-current' : 'tv-meal'} aria-label="Dinner">
            <div className="tv-meal-head">
              <h2 className="tv-meal-name">Dinner</h2>
              <span className="tv-meal-time">{times.dinner}</span>
              {current === 'dinner' && <span className="tv-now-flag">Now</span>}
            </div>
            <ChoiceBlock label="Choice A" option={menu.dinnerA} />
            <ChoiceBlock label="Choice B" option={menu.dinnerB} />
            {menu.dinnerDessert.length > 0 && (
              <div>
                <p className="tv-dessert-label">Dessert</p>
                {menu.dinnerDessert.map(name => <p key={name} className="tv-dish">{name}</p>)}
              </div>
            )}
            {optionIsEmpty(menu.dinnerA) && optionIsEmpty(menu.dinnerB) && menu.dinnerDessert.length === 0 && (
              <p className="tv-empty">—</p>
            )}
          </section>
        </div>
      )}

      <footer className="tv-foot">
        {stale && <span className="tv-stale">Offline — last menu {fetchedAt ? ageLabel(fetchedAt, now.getTime()) : ''}</span>}
        {!stale && fetchedAt && <span>Updated {ageLabel(fetchedAt, now.getTime())}</span>}
        {DEMO_MODE && <span>Demo preview</span>}
        <Link to="/tv/setup" className="tv-setup-link">Display setup</Link>
      </footer>
    </div>
  )
}
