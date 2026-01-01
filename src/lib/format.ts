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
 * Format recurrence type to German display string
 * @param recurrence - Recurrence type
 * @returns Formatted recurrence string
 */
export function formatRecurrence(recurrence: string): string {
  const map: Record<string, string> = {
    einmalig: 'Einmalig',
    monatlich: 'Monatlich',
    vierteljährlich: 'Vierteljährlich',
    jährlich: 'Jährlich',
  }
  return map[recurrence] || recurrence
}
