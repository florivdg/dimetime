import { auth } from '@/lib/auth'
import type { APIRoute } from 'astro'

export const ALL: APIRoute = async (ctx) => {
  // Set x-forwarded-for header for rate limiting behind proxies
  ctx.request.headers.set('x-forwarded-for', ctx.clientAddress)
  return auth.handler(ctx.request)
}
