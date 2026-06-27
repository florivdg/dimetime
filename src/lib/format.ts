/**
 * Format a monetary amount in cents to German currency format
 * @param cents - Amount in cents (e.g., 1234 for 12.34 EUR)
 * @returns Formatted string (e.g., "12,34 €")
 */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

/**
 * Format a date string to German locale format
 * @param date - Date string or Date object
 * @param style - 'short' | 'medium' | 'long' | 'full' (default: 'medium')
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  style: 'short' | 'medium' | 'long' | 'full' = 'medium',
): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: style,
  }).format(new Date(date))
}

/**
 * Format a date with time to German locale format
 * @param date - Date string or Date object
 * @param dateStyle - 'short' | 'medium' | 'long' | 'full' (default: 'medium')
 * @param timeStyle - 'short' | 'medium' | 'long' | 'full' (default: 'short')
 * @returns Formatted datetime string
 */
export function formatDateTime(
  date: string | Date,
  dateStyle: 'short' | 'medium' | 'long' | 'full' = 'medium',
  timeStyle: 'short' | 'medium' | 'long' | 'full' = 'short',
): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle,
    timeStyle,
  }).format(new Date(date))
}

/**
 * Get display name for a plan (name or formatted month/year fallback)
 */
export function getPlanDisplayName(
  name: string | null | undefined,
  date: string | null | undefined,
): string {
  if (name) return name
  if (!date) return '-'
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Truncate text to a maximum length, appending an ellipsis if needed
 */
export function truncateText(text: string | null, maxLength = 100): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '…'
}

export interface MonthPacing {
  daysElapsed: number
  totalDays: number
  percentElapsed: number
  isCurrent: boolean
}

/**
 * Compute time pacing within the calendar month of a plan date.
 * `planDate` is YYYY-MM-DD; the month containing it defines the period.
 */
export function getMonthPacing(
  planDate: string,
  today: Date = new Date(),
): MonthPacing {
  const [yearStr, monthStr] = planDate.split('-')
  const year = Number(yearStr)
  const monthIdx = Number(monthStr) - 1
  const totalDays = new Date(year, monthIdx + 1, 0).getDate()

  const isCurrent =
    today.getFullYear() === year && today.getMonth() === monthIdx
  const isPast =
    today.getFullYear() > year ||
    (today.getFullYear() === year && today.getMonth() > monthIdx)

  let daysElapsed: number
  if (isCurrent) daysElapsed = today.getDate()
  else if (isPast) daysElapsed = totalDays
  else daysElapsed = 0

  return {
    daysElapsed,
    totalDays,
    percentElapsed: (daysElapsed / totalDays) * 100,
    isCurrent,
  }
}

/**
 * Format recurrence type to German display string
 * @param recurrence - Recurrence type
 * @returns Formatted recurrence string
 */
export function formatRecurrence(recurrence: string): string {
  const map: Record<string, string> = {
    einmalig: 'Einmalig',
    monatlich: 'Monatlich',
    vierteljährlich: 'Vierteljährlich',
    halbjährlich: 'Halbjährlich',
    jährlich: 'Jährlich',
  }
  return map[recurrence] || recurrence
}
