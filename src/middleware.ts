import { auth } from '@/lib/auth'
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

  // Allow 2FA setup page (auth required, 2FA not required)
  if (pathname === '/2fa/setup') {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    })
    if (!session) {
      return context.redirect('/login')
    }
    context.locals.user = session.user
    context.locals.session = session.session
    return next()
  }

  // Protect all other API routes (check BEFORE general page protection)
  if (pathname.startsWith('/api/')) {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    })

    if (!session) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Block API access for users without 2FA enabled
    const user = session.user as { twoFactorEnabled?: boolean }
    if (!user.twoFactorEnabled) {
      return new Response(
        JSON.stringify({ error: '2FA-Einrichtung erforderlich' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    context.locals.user = session.user
    context.locals.session = session.session
    return next()
  }

  // Protect all pages (fallback for everything else)
  const session = await auth.api.getSession({
    headers: context.request.headers,
  })

  if (!session) {
    const redirectTo = encodeURIComponent(pathname + context.url.search)
    return context.redirect(`/login?redirectTo=${redirectTo}`)
  }

  // Enforce 2FA setup for authenticated users
  const user = session.user as { twoFactorEnabled?: boolean }
  if (!user.twoFactorEnabled) {
    return context.redirect('/2fa/setup')
  }

  context.locals.user = session.user
  context.locals.session = session.session
  return next()
})
