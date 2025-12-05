import { auth } from '@/lib/auth'
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Allow auth API routes
  if (pathname.startsWith('/api/auth')) {
    return next()
  }

  // Allow login page (redirect to dashboard if already authenticated)
  if (pathname === '/login') {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    })
    if (session) {
      return context.redirect('/')
    }
    return next()
  }

  // Protect all other pages
  if (pathname.startsWith('/')) {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    })

    if (!session) {
      const redirectTo = encodeURIComponent(pathname + context.url.search)
      return context.redirect(`/login?redirectTo=${redirectTo}`)
    }

    context.locals.user = session.user
    context.locals.session = session.session
    return next()
  }

  // Protect all API routes
  if (pathname.startsWith('/api')) {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    })

    if (!session) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    context.locals.user = session.user
    context.locals.session = session.session
    return next()
  }

  return next()
})
