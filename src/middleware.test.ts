import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as authSchema from '@/db/schema/auth'
import { createTestDb } from '@/lib/__fixtures__/test-db'

const harness = createTestDb()
const testDb = harness.db

type Session = {
  user: { id: string; twoFactorEnabled?: boolean }
  session: { id: string }
} | null

const sessionState: { value: Session } = { value: null }

void mock.module('@/db/database', () => ({
  db: testDb,
}))

void mock.module('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => sessionState.value,
    },
  },
}))

void mock.module('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}))

const { onRequest } = (await import('./middleware')) as unknown as {
  onRequest: (
    context: {
      url: URL
      request: Request
      locals: Record<string, unknown>
      redirect: (path: string) => Response
    },
    next: () => Response | Promise<Response>,
  ) => Promise<Response>
}

function buildContext(pathname: string, search = '') {
  const url = new URL(`http://test.local${pathname}${search}`)
  const request = new Request(url.toString(), { method: 'GET' })
  const locals: Record<string, unknown> = {}
  const redirect = (path: string) =>
    new Response(null, { status: 302, headers: { Location: path } })
  return { url, request, locals, redirect }
}

const nextSentinel = new Response('next-called')
const next = () => nextSentinel

beforeEach(async () => {
  sessionState.value = null
  harness.reset()
  await testDb.insert(authSchema.user).values({
    id: 'u-1',
    name: 'A',
    email: 'a@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

afterEach(() => {
  sessionState.value = null
})

describe('onRequest middleware', () => {
  it('bypasses /api/auth/* without session check', async () => {
    const ctx = buildContext('/api/auth/sign-in')
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
  })

  it('redirects /login to / when session exists', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: true },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/login')
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
  })

  it('allows /login through when no session', async () => {
    const ctx = buildContext('/login')
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
  })

  it('always allows /2fa/verify without session check', async () => {
    const ctx = buildContext('/2fa/verify')
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
  })

  it('returns 401 JSON for unauthenticated /api/* request', async () => {
    const ctx = buildContext('/api/transactions')
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Nicht autorisiert' })
  })

  it('redirects unauthenticated page request to /login with redirectTo', async () => {
    const ctx = buildContext('/plans', '?archived=true')
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe(
      '/login?redirectTo=%2Fplans%3Farchived%3Dtrue',
    )
  })

  it('redirects authenticated user without 2FA to /2fa/setup', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: false },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/plans')
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/2fa/setup')
  })

  it('allows authenticated user without 2FA on /2fa/setup', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: false },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/2fa/setup')
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
  })

  it('returns 403 JSON for authenticated user without 2FA hitting /api/*', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: false },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/api/transactions')
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: '2FA-Einrichtung erforderlich' })
  })

  it('attaches locals.user/session/userSettings and calls next() for authenticated 2FA user', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: true },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/plans')
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
    expect(ctx.locals.user).toEqual({ id: 'u-1', twoFactorEnabled: true })
    expect(ctx.locals.session).toEqual({ id: 's-1' })
    expect(ctx.locals.userSettings).toEqual({
      themePreference: 'system',
      groupTransactionsByType: false,
    })
  })

  it('uses stored settings when present', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: true },
      session: { id: 's-1' },
    }
    const { userSetting } = await import('@/db/schema/settings')
    await testDb.insert(userSetting).values({
      userId: 'u-1',
      key: 'themePreference',
      value: '"dark"',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const ctx = buildContext('/plans')
    await onRequest(ctx, next)
    expect(
      (ctx.locals.userSettings as { themePreference: string }).themePreference,
    ).toBe('dark')
  })
})
