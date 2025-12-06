/**
 * Validates and returns a safe redirect URL.
 * Prevents open redirect vulnerabilities by ensuring URLs are:
 * - Relative paths starting with /
 * - Not protocol-relative URLs (//evil.com)
 * - Free of dangerous protocols (javascript:, data:, vbscript:)
 * - Same-origin (client-side only)
 */
export function getSafeRedirectUrl(
  url: string | null | undefined,
  fallback = '/',
): string {
  if (!url) return fallback

  // Must be a relative path starting with /
  if (!url.startsWith('/')) return fallback

  // Block protocol-relative URLs (//evil.com)
  if (url.startsWith('//')) return fallback

  // Block dangerous protocols
  const lowercaseUrl = url.toLowerCase()
  if (
    lowercaseUrl.includes('javascript:') ||
    lowercaseUrl.includes('data:') ||
    lowercaseUrl.includes('vbscript:')
  ) {
    return fallback
  }

  // Client-side only: validate same-origin
  if (typeof window !== 'undefined') {
    try {
      const parsed = new URL(url, window.location.origin)
      if (parsed.origin !== window.location.origin) return fallback
    } catch {
      return fallback
    }
  }

  return url
}
