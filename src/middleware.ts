import { handleApiKeyRequest, hasApiKeyHeader } from '@/lib/api-key-auth'
import { auth } from '@/lib/auth'
import { AUTH_API_PREFIX, jsonAuthError } from '@/lib/auth-http'
import { getAllSettings } from '@/lib/settings'
import { defineMiddleware } from 'astro:middleware'

type MiddlewareContext = Parameters<Parameters<typeof defineMiddleware>[0]>[0]
type MiddlewareNext = Parameters<Parameters<typeof defineMiddleware>[0]>[1]
type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

const API_KEY_MANAGEMENT_PREFIX = `${AUTH_API_PREFIX}/api-key`

async function handleLoginRoute(
  context: MiddlewareContext,
  next: MiddlewareNext,
) {
  const session = await auth.api.getSession({
    headers: context.request.headers,
  })
  if (session) return context.redirect('/')
  return next()
}

function rejectUnauthenticated(context: MiddlewareContext, pathname: string) {
  if (pathname.startsWith('/api/')) {
    return jsonAuthError('Nicht autorisiert', 401)
  }
  const redirectTo = encodeURIComponent(pathname + context.url.search)
  return context.redirect(`/login?redirectTo=${redirectTo}`)
}

function requireTwoFactorSetup(
  context: MiddlewareContext,
  pathname: string,
  session: Session,
): Response | null {
  const user = session.user as { twoFactorEnabled?: boolean }
  if (user.twoFactorEnabled || pathname === '/2fa/setup') return null
  if (pathname.startsWith('/api/')) {
    return jsonAuthError('2FA-Einrichtung erforderlich', 403)
  }
  return context.redirect('/2fa/setup')
}

async function attachAuthenticatedLocals(
  context: MiddlewareContext,
  session: Session,
) {
  context.locals.user = session.user
  context.locals.session = session.session
  context.locals.userSettings = await getAllSettings(session.user.id)
}

/**
 * Gate for the `/api/auth/api-key/*` management endpoints.
 *
 * better-auth's own key endpoints only require a session, so without this check
 * a password-authenticated user who has not set up 2FA yet could mint a key and
 * then read financial data through the deliberately 2FA-exempt key path.
 * Unauthenticated requests are passed through so better-auth still answers with
 * its own 401.
 */
async function handleApiKeyManagementRoute(
  context: MiddlewareContext,
  next: MiddlewareNext,
) {
  let session: Session | null = null
  try {
    session = await auth.api.getSession({ headers: context.request.headers })
  } catch {
    session = null
  }
  if (!session) return next()

  return requireTwoFactorSetup(context, context.url.pathname, session) ?? next()
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (hasApiKeyHeader(context.request)) {
    return handleApiKeyRequest(context, next)
  }

  const { pathname } = context.url

  if (pathname.startsWith(API_KEY_MANAGEMENT_PREFIX)) {
    return handleApiKeyManagementRoute(context, next)
  }
  if (pathname.startsWith(AUTH_API_PREFIX)) return next()
  if (pathname === '/login') return handleLoginRoute(context, next)
  if (pathname === '/2fa/verify') return next()

  const session = await auth.api.getSession({
    headers: context.request.headers,
  })
  if (!session) return rejectUnauthenticated(context, pathname)

  const twoFactorBlock = requireTwoFactorSetup(context, pathname, session)
  if (twoFactorBlock) return twoFactorBlock

  await attachAuthenticatedLocals(context, session)
  return next()
})
