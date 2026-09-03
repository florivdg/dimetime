const wholeEuroFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const monthYearFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
})

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
 * Format a monetary amount in cents as whole euros, for coarse statements
 * where cent precision would suggest accuracy that is not there.
 * @param cents - Amount in cents (e.g., 155000 for 1550.00 EUR)
 * @returns Formatted string without decimals (e.g., "1.550 €")
 */
export function formatWholeEuros(cents: number): string {
  return wholeEuroFormatter.format(Math.round(cents / 100))
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
  return monthYearFormatter.format(new Date(date))
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
 * Parse the calendar month out of a plan date without going through UTC.
 * `new Date('YYYY-MM-DD')` would be parsed as UTC midnight and can shift the
 * month in negative offsets, so the parts are read manually.
 * @param planDate - Plan date as YYYY-MM-DD
 * @returns Year, zero-based month index and the number of days in that month
 */
function parsePlanMonth(planDate: string): {
  year: number
  monthIdx: number
  totalDays: number
} {
  const [yearStr, monthStr] = planDate.split('-')
  const year = Number(yearStr)
  const monthIdx = Number(monthStr) - 1
  return {
    year,
    monthIdx,
    totalDays: new Date(year, monthIdx + 1, 0).getDate(),
  }
}

/**
 * Format the calendar month of a plan date as a German month/year label.
 * Goes through `parsePlanMonth` so the label cannot shift into the previous
 * month in negative UTC offsets.
 * @param planDate - Plan date as YYYY-MM-DD
 * @returns Label such as "September 2026"
 */
export function formatPlanMonthLabel(planDate: string): string {
  const { year, monthIdx } = parsePlanMonth(planDate)
  return monthYearFormatter.format(new Date(year, monthIdx, 1))
}

/**
 * Compute time pacing within the calendar month of a plan date.
 * `planDate` is YYYY-MM-DD; the month containing it defines the period.
 */
export function getMonthPacing(
  planDate: string,
  today: Date = new Date(),
): MonthPacing {
  const { year, monthIdx, totalDays } = parsePlanMonth(planDate)

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

export interface MonthWeekSegment {
  startDay: number
  endDay: number
  isoWeek: number
  startPercent: number
  widthPercent: number
  isCurrent: boolean
}

/**
 * Get the ISO-8601 calendar week (1-53) of a date.
 * Week 1 is the week containing the first Thursday of the year.
 * The date is normalized to UTC midnight so DST shifts cannot skew the math.
 * @param date - Date to inspect (interpreted in local time)
 * @returns ISO week number
 */
export function getIsoWeek(date: Date): number {
  /** Move a UTC date onto the Thursday of its own ISO week (Monday = 0) */
  const toIsoThursday = (utcDate: Date): Date => {
    const weekdayIdx = (utcDate.getUTCDay() + 6) % 7
    utcDate.setUTCDate(utcDate.getUTCDate() - weekdayIdx + 3)
    return utcDate
  }

  const target = toIsoThursday(
    new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
  )
  // Thursday of week 1 is the Thursday of the week containing January 4th
  const firstThursday = toIsoThursday(
    new Date(Date.UTC(target.getUTCFullYear(), 0, 4)),
  )

  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return (
    1 + Math.round((target.getTime() - firstThursday.getTime()) / msPerWeek)
  )
}

/**
 * Split the calendar month of a plan date into ISO week segments.
 * Weeks run Monday to Sunday and are clipped at the month boundaries, so the
 * first and last segment are usually shorter than seven days.
 * `planDate` is YYYY-MM-DD; the month containing it defines the period.
 * @param planDate - Plan date as YYYY-MM-DD
 * @param today - Reference date, injectable for tests (default: now)
 * @returns Segments in chronological order, covering the whole month
 */
export function getMonthWeekSegments(
  planDate: string,
  today: Date = new Date(),
): MonthWeekSegment[] {
  const { year, monthIdx, totalDays } = parsePlanMonth(planDate)

  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === monthIdx
  // 0 never falls into a segment, so foreign months mark nothing as current
  const todayDay = isCurrentMonth ? today.getDate() : 0

  const segments: MonthWeekSegment[] = []
  let startDay = 1
  while (startDay <= totalDays) {
    const startDate = new Date(year, monthIdx, startDay)
    const weekdayIdx = (startDate.getDay() + 6) % 7 // Monday = 0
    const endDay = Math.min(startDay + (6 - weekdayIdx), totalDays)
    const days = endDay - startDay + 1

    segments.push({
      startDay,
      endDay,
      isoWeek: getIsoWeek(startDate),
      startPercent: ((startDay - 1) / totalDays) * 100,
      widthPercent: (days / totalDays) * 100,
      isCurrent: todayDay >= startDay && todayDay <= endDay,
    })

    startDay = endDay + 1
  }

  return segments
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
