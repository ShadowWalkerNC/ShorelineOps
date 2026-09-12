/**
 * Nightly forecast rollup (C05).
 *
 * One scheduled job, following the repo's existing scheduler pattern
 * (OperationsHealerBot.startDaemon in server/src/agent/healer.ts): a plain
 * setInterval started from server/src/index.ts after migrations — no job
 * framework.
 *
 * ── avg_usage FORMULA (documented for the dietitian) ─────────────────────
 * avg_usage on order_guides is the trailing-28-day average DAILY consumption
 * for each order-guide line, expressed in the vendor item's own unit.
 *
 *   consumption(line) = SUM(inventory_transactions.qty)
 *                       for type IN ('issue', 'waste')
 *                       over the last 28 full days
 *   avg_usage(line)   = consumption(line) / 28
 *
 * Join path:
 *   inventory_transactions → inventory_items (vendor_sku)
 *     → vendor_items (vendor_sku + vendor_id) → order_guides (vendor_item_id)
 *
 * - Only 'issue' and 'waste' count as consumption. 'receipt' adds stock and
 *   'count_adjust' corrects it — neither is usage.
 * - Guide lines with no matching transactions keep their previous avg_usage
 *   (NULL until the first rollup that sees usage for them) — the rollup never
 *   invents a zero or a guess.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { pool } from '../db/pool'

export const AVG_USAGE_WINDOW_DAYS = 28

export interface AvgUsageRollupResult {
  updated: number
  windowDays: number
  cutoff: string
  ranAt: string
}

export async function rollupAvgUsage(): Promise<AvgUsageRollupResult> {
  const cutoff = new Date(Date.now() - AVG_USAGE_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10)

  // Portable date comparison: created_at is TIMESTAMPTZ on PG and a
  // 'YYYY-MM-DD HH:MM:SS' TEXT on SQLite — both compare lexicographically
  // against a 'YYYY-MM-DD' cutoff computed in JS.
  const { rows } = await pool.query(
    `SELECT vi.vendor_id AS vendor_id,
            vi.id        AS vendor_item_id,
            COALESCE(SUM(t.qty), 0) AS consumed
     FROM order_guides og
     JOIN vendor_items vi
       ON vi.id = og.vendor_item_id
     JOIN inventory_items ii
       ON ii.vendor_sku = vi.vendor_sku
     JOIN inventory_transactions t
       ON t.item_id = ii.id
      AND t.type IN ('issue', 'waste')
      AND t.created_at >= $1
     GROUP BY vi.vendor_id, vi.id`,
    [cutoff]
  )

  let updated = 0
  for (const r of rows) {
    const avg = parseFloat(r.consumed) / AVG_USAGE_WINDOW_DAYS
    await pool.query(
      `UPDATE order_guides
       SET avg_usage = $1, updated_at = NOW()
       WHERE vendor_id = $2 AND vendor_item_id = $3`,
      [avg, r.vendor_id, r.vendor_item_id]
    )
    updated += 1
  }

  const result: AvgUsageRollupResult = {
    updated,
    windowDays: AVG_USAGE_WINDOW_DAYS,
    cutoff,
    ranAt: new Date().toISOString(),
  }
  console.log(
    `[nightly-forecast] avg_usage rollup: updated ${updated} order-guide line(s), ` +
    `window ${AVG_USAGE_WINDOW_DAYS}d (since ${cutoff})`
  )
  return result
}

let rollupTimer: ReturnType<typeof setInterval> | null = null

/**
 * Start the nightly rollup. Runs once at startup (so a fresh deploy has real
 * avg_usage immediately) and then every `intervalMs` (default 24h).
 * Follows the OperationsHealerBot.startDaemon pattern — plain setInterval.
 */
export function startNightlyForecastRollup(
  intervalMs: number = 24 * 60 * 60 * 1000
): void {
  if (rollupTimer) return
  console.log('[nightly-forecast] Starting avg_usage rollup daemon (every 24h)...')

  const run = async () => {
    try {
      await rollupAvgUsage()
    } catch (err: any) {
      console.error('[nightly-forecast] avg_usage rollup failed:', err?.message ?? err)
    }
  }

  run()
  rollupTimer = setInterval(run, intervalMs)
}

export function stopNightlyForecastRollup(): void {
  if (rollupTimer) {
    clearInterval(rollupTimer)
    rollupTimer = null
  }
}
