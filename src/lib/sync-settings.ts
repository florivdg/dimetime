import type { ThemePreference } from '@/lib/settings'

/**
 * Converts API theme values to localStorage values used by VueUse.
 * API uses 'system', localStorage uses 'auto'.
 */
export function apiToLocalTheme(value: ThemePreference): string {
  return value === 'system' ? 'auto' : value
}

/**
 * Fetches user settings from API and syncs theme to localStorage.
 * Call this after successful authentication before redirecting.
 */
export async function syncSettingsToLocalStorage(): Promise<void> {
  try {
    const response = await fetch('/api/settings')
    if (!response.ok) return

    const settings = await response.json()

    if (settings.themePreference) {
      localStorage.setItem(
        'vueuse-color-scheme',
        apiToLocalTheme(settings.themePreference),
      )
    }
  } catch {
    // Silently fail - user will get default theme
  }
}
