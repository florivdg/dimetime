const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:'] as const

function hasDangerousProtocol(url: string): boolean {
  const lower = url.toLowerCase()
  return DANGEROUS_PROTOCOLS.some((p) => lower.includes(p))
}

function isSameOriginClientSide(url: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin === window.location.origin
  } catch {
    return false
  }
}

function isUnsafeRedirectUrl(url: string): boolean {
  if (!url.startsWith('/')) return true
  if (url.startsWith('//')) return true
  if (hasDangerousProtocol(url)) return true
  return !isSameOriginClientSide(url)
}

export function getSafeRedirectUrl(
  url: string | null | undefined,
  fallback = '/',
): string {
  if (!url) return fallback
  return isUnsafeRedirectUrl(url) ? fallback : url
}
