import { auth } from '@/lib/auth'
import { getAllSettings } from '@/lib/settings'
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Allow auth API routes (must be first)
  if (pathname.startsWith('/api/auth')) {
    return next()
  }

  // Allow login page (redirect to home if already authenticated)
  if (pathname === '/login') {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    })
    if (session) {
      return context.redirect('/')
    }
    return next()
  }

  // Allow 2FA verify page without session check
  // When 2FA is pending, Better Auth uses a temporary token, not a full session
  // The client-side verification will handle the actual auth flow
  if (pathname === '/2fa/verify') {
    return next()
  }

  // All remaining routes require authentication - get session ONCE
  const session = await auth.api.getSession({
    headers: context.request.headers,
  })

  // Handle unauthenticated requests
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const redirectTo = encodeURIComponent(pathname + context.url.search)
    return context.redirect(`/login?redirectTo=${redirectTo}`)
  }

  // Check 2FA requirement (except for /2fa/setup which is where they set it up)
  const user = session.user as { twoFactorEnabled?: boolean }
  if (!user.twoFactorEnabled && pathname !== '/2fa/setup') {
    if (pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ error: '2FA-Einrichtung erforderlich' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    return context.redirect('/2fa/setup')
  }

  // Set locals for all authenticated routes - ONCE
  context.locals.user = session.user
  context.locals.session = session.session
  context.locals.userSettings = await getAllSettings(session.user.id)
  return next()
})
