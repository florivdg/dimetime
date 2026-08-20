import type { APIContext, MiddlewareNext } from 'astro'
import { auth } from '@/lib/auth'
import { AUTH_API_PREFIX, jsonAuthError } from '@/lib/auth-http'

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * The rate limiter rejects with `details.tryAgainIn` in milliseconds; surface it
 * as a `Retry-After` header (whole seconds, as the header requires).
 */
function retryAfterHeaders(error: unknown): Record<string, string> | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const details = (error as { body?: { details?: unknown } | null }).body
    ?.details
  if (typeof details !== 'object' || details === null) return undefined
  const { tryAgainIn } = details as { tryAgainIn?: unknown }
  if (typeof tryAgainIn !== 'number' || !Number.isFinite(tryAgainIn)) {
    return undefined
  }
  return { 'Retry-After': String(Math.max(1, Math.ceil(tryAgainIn / 1000))) }
}

/**
 * Map a `getSession` failure on the API-key path onto a response. A throttled
 * key must not look like a revoked one, and a server-side fault must not be
 * reported as an authentication problem, so only genuine client-side auth
 * failures keep the 401.
 *
 * better-auth's `APIError` always carries a numeric `statusCode`; anything else
 * that lands here is an unexpected fault and is reported as a 500.
 */
function apiKeySessionErrorResponse(error: unknown): Response {
  const status = (error as { statusCode?: unknown } | null)?.statusCode
  if (status === 429) {
    return jsonAuthError('Zu viele Anfragen', 429, retryAfterHeaders(error))
  }
  if (typeof status !== 'number' || status >= 500) {
    return jsonAuthError('Interner Serverfehler', 500)
  }
  return jsonAuthError('Ungültiger API-Schlüssel', 401)
}

/**
 * A blank or whitespace-only header is ignored by the API-key plugin, which
 * would make `getSession` silently fall back to the session cookie inside the
 * 2FA-exempt key path. Treat such headers as absent.
 */
export function hasApiKeyHeader(request: Request): boolean {
  const header = request.headers.get('x-api-key')
  return header !== null && header.trim() !== ''
}

/**
 * Auth path for requests carrying an `x-api-key` header.
 *
 * API keys grant read-only access to the `/api/*` surface. They can never be
 * used for mutating requests, for page routes or for the `/api/auth/*` surface
 * (so a key can neither create nor revoke keys). Because a key cannot perform
 * a TOTP challenge, the 2FA-setup gate is skipped for key-authenticated
 * requests.
 */
export async function handleApiKeyRequest(
  context: APIContext,
  next: MiddlewareNext,
) {
  if (!READ_ONLY_METHODS.has(context.request.method)) {
    return jsonAuthError('API-Schlüssel erlauben nur Lesezugriff', 403)
  }

  const { pathname } = context.url
  if (!pathname.startsWith('/api/') || pathname.startsWith(AUTH_API_PREFIX)) {
    return jsonAuthError('API-Schlüssel sind nur für API-Endpunkte gültig', 403)
  }

  let session: Session | null = null
  try {
    session = await auth.api.getSession({ headers: context.request.headers })
  } catch (error) {
    return apiKeySessionErrorResponse(error)
  }
  if (!session) return jsonAuthError('Ungültiger API-Schlüssel', 401)

  // Banning a user revokes their database sessions but leaves `apikey` rows in
  // place, and the plugin reconstructs a session from the key without ever
  // consulting the `banned` flag. Check it here so a ban takes effect
  // immediately instead of only after every key has been revoked.
  const user = session.user as { banned?: boolean | null }
  if (user.banned) return jsonAuthError('Benutzerkonto ist gesperrt', 403)

  // No `userSettings` lookup: they are only read while rendering a page, and
  // key requests never reach one (every non-`/api/` path is rejected above).
  context.locals.user = session.user
  context.locals.session = session.session
  return next()
}
