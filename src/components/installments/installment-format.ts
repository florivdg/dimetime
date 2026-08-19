/**
 * Display helpers for `YYYY-MM` month keys used by the Ratenzahlungen UI.
 */

/**
 * Turn a `YYYY-MM` month key into a Date on the first of that month (local
 * time) — the form the chart axis needs.
 */
export function monthToDate(month: string): Date {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber - 1, 1)
}

/**
 * Format a `YYYY-MM` month key as `MM/JJJJ` (e.g. "09/2027").
 */
export function formatMonthNumeric(month: string): string {
  const [year, monthNumber] = month.split('-')
  return `${monthNumber}/${year}`
}

/**
 * Format a month for the chart axis, e.g. "Sep 26".
 */
export function formatMonthShort(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: '2-digit',
  }).format(date)
}

/**
 * Share of the installments already paid, in percent. Rounded and capped at
 * 100 — `paidCount` may exceed the total when rates were prepaid.
 */
export function ratePercent(
  paidCount: number,
  totalInstallments: number,
): number {
  if (totalInstallments <= 0) return 0
  return Math.min(100, Math.round((paidCount / totalInstallments) * 100))
}
