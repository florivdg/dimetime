/**
 * HTTP primitives shared by the auth middleware and its extracted guards.
 */

/** Prefix of better-auth's own HTTP surface, mounted at `/api/auth/[...all]`. */
export const AUTH_API_PREFIX = '/api/auth'

/** JSON error body used by every auth rejection the middleware produces. */
export function jsonAuthError(
  message: string,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}
