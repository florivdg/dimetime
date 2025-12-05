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
