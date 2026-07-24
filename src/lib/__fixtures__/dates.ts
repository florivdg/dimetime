/**
 * Date helpers for tests that depend on "now" (dashboard range queries).
 *
 * Deliberately standalone: `formatYearMonth` lives in `@/lib/plans`, which
 * pulls in `@/db/database` — importing it statically from a fixture would open
 * the real database before `setupTestDb()` can mock the module.
 */

/**
 * `YYYY-MM-DD` in the month `offsetMonths` from the current one.
 * Positive offsets are in the future, negative ones in the past.
 */
export function monthOffsetDate(offsetMonths: number, day = '15'): string {
  const today = new Date()
  const d = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}
