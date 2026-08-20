/**
 * Shared date helpers.
 *
 * Months are `YYYY-MM` strings, dates `YYYY-MM-DD` — both are compared
 * lexicographically on purpose (see `@/lib/preset-matching`).
 */

/**
 * Format a date as a `YYYY-MM` month key (local time).
 */
export function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * The current month as `YYYY-MM` (local time).
 */
export function currentMonth(): string {
  return formatYearMonth(new Date())
}

/**
 * The `YYYY-MM` month a `YYYY-MM-DD` plan/due date belongs to.
 */
export function monthOfPlanDate(date: string): string {
  return date.substring(0, 7)
}

/**
 * The month following `month` (both `YYYY-MM`).
 */
export function nextMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  if (monthNumber >= 12) return `${year + 1}-01`
  return `${year}-${String(monthNumber + 1).padStart(2, '0')}`
}

/**
 * Resolve the due date for a row materialized into a plan: an explicit
 * override wins, otherwise `dayOfMonth` clamped to the last day of the plan's
 * month, falling back to the plan date itself.
 * @param planDate - Plan date in YYYY-MM-DD format
 * @param dayOfMonth - Preferred day of month (1-31), nullable
 * @param override - Optional explicit due date in YYYY-MM-DD format
 */
export function resolveDueDate(
  planDate: string,
  dayOfMonth: number | null,
  override?: string,
): string {
  if (override) return override
  if (!dayOfMonth) return planDate
  const [year, month] = planDate.split('-').map(Number)
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const day = Math.min(dayOfMonth, lastDayOfMonth)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
