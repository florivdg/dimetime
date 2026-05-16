import { auth } from '@/lib/auth'
import { getAllSettings } from '@/lib/settings'
import { defineMiddleware } from 'astro:middleware'

type MiddlewareContext = Parameters<Parameters<typeof defineMiddleware>[0]>[0]
type MiddlewareNext = Parameters<Parameters<typeof defineMiddleware>[0]>[1]
type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

function jsonAuthError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

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

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  if (pathname.startsWith('/api/auth')) return next()
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
