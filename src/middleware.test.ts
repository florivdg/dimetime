import { beforeEach, describe, expect, it, mock } from 'bun:test'
import * as authSchema from '@/db/schema/auth'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { APIError } from 'better-auth/api'

const harness = createTestDb()
const testDb = harness.db

type Session = {
  user: { id: string; twoFactorEnabled?: boolean; banned?: boolean | null }
  session: { id: string }
} | null

const sessionState: {
  value: Session
  error: unknown
  callCount: number
} = { value: null, error: null, callCount: 0 }

void mock.module('@/db/database', () => ({
  db: testDb,
}))

void mock.module('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => {
        sessionState.callCount += 1
        if (sessionState.error !== null) throw sessionState.error
        return sessionState.value
      },
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

function buildContext(
  pathname: string,
  search = '',
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  const url = new URL(`http://test.local${pathname}${search}`)
  const request = new Request(url.toString(), {
    method: init.method ?? 'GET',
    headers: init.headers,
  })
  const locals: Record<string, unknown> = {}
  const redirect = (path: string) =>
    new Response(null, { status: 302, headers: { Location: path } })
  return { url, request, locals, redirect }
}

const nextSentinel = new Response('next-called')
const next = () => nextSentinel

beforeEach(async () => {
  sessionState.value = null
  sessionState.error = null
  sessionState.callCount = 0
  harness.reset()
  await testDb.insert(authSchema.user).values({
    id: 'u-1',
    name: 'A',
    email: 'a@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

describe('onRequest middleware', () => {
  it('bypasses /api/auth/* without session check', async () => {
    const ctx = buildContext('/api/auth/sign-in')
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
  })

  it('bypasses other /api/auth/* routes without any session check', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: false },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/api/auth/two-factor/verify-totp', '', {
      method: 'POST',
    })
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
    expect(sessionState.callCount).toBe(0)
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

describe('onRequest middleware — API-Key-Requests', () => {
  const apiKeyHeaders = { 'x-api-key': 'dt_test-key' }

  it('allows GET /api/* with a valid key and bypasses the 2FA gate', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: false },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/api/transactions', '', {
      headers: apiKeyHeaders,
    })
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
    expect(ctx.locals.user).toEqual({ id: 'u-1', twoFactorEnabled: false })
    expect(ctx.locals.session).toEqual({ id: 's-1' })
    // Settings are only read while rendering a page, which a key can never do.
    expect(ctx.locals.userSettings).toBeUndefined()
  })

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    it(`rejects ${method} /api/* with 403 without checking the session`, async () => {
      sessionState.value = {
        user: { id: 'u-1', twoFactorEnabled: true },
        session: { id: 's-1' },
      }
      const ctx = buildContext('/api/transactions', '', {
        method,
        headers: apiKeyHeaders,
      })
      const res = await onRequest(ctx, next)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({
        error: 'API-Schlüssel erlauben nur Lesezugriff',
      })
      expect(sessionState.callCount).toBe(0)
    })
  }

  it('rejects POST /api/auth/api-key/create with 403 (keys cannot manage keys)', async () => {
    const ctx = buildContext('/api/auth/api-key/create', '', {
      method: 'POST',
      headers: apiKeyHeaders,
    })
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'API-Schlüssel erlauben nur Lesezugriff',
    })
    expect(sessionState.callCount).toBe(0)
  })

  for (const { label, error, status, message, retryAfter } of [
    {
      label: 'returns 401 when the session lookup throws for an invalid key',
      // Shape thrown by the api-key plugin for an unknown/disabled/expired key.
      error: () =>
        APIError.from('UNAUTHORIZED', {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key.',
        }),
      status: 401,
      message: 'Ungültiger API-Schlüssel',
      retryAfter: null,
    },
    {
      label: 'returns 429 with Retry-After when the key hits the rate limit',
      // Shape thrown by the plugin's `consumeRateLimit` deny branch.
      error: () =>
        new APIError('TOO_MANY_REQUESTS', {
          message: 'Rate limit exceeded. Try again later.',
          code: 'RATE_LIMITED',
          details: { tryAgainIn: 42_000 },
        }),
      status: 429,
      message: 'Zu viele Anfragen',
      retryAfter: '42',
    },
    {
      label: 'rounds sub-second retry hints up to one second',
      error: () =>
        new APIError('TOO_MANY_REQUESTS', {
          message: 'Rate limit exceeded. Try again later.',
          code: 'RATE_LIMITED',
          details: { tryAgainIn: 120 },
        }),
      status: 429,
      message: 'Zu viele Anfragen',
      retryAfter: '1',
    },
    {
      label: 'returns 429 without Retry-After when the quota is exhausted',
      // `remaining === 0` throws TOO_MANY_REQUESTS without retry details.
      error: () =>
        APIError.from('TOO_MANY_REQUESTS', {
          code: 'USAGE_EXCEEDED',
          message: 'API Key has reached their request limit.',
        }),
      status: 429,
      message: 'Zu viele Anfragen',
      retryAfter: null,
    },
    {
      label: 'returns 500 when the session lookup fails unexpectedly',
      error: () => new Error('database is locked'),
      status: 500,
      message: 'Interner Serverfehler',
      retryAfter: null,
    },
    {
      label:
        'returns 500 for a server-side APIError instead of masking it as 401',
      error: () =>
        APIError.from('INTERNAL_SERVER_ERROR', {
          code: 'FAILED_TO_UPDATE_API_KEY',
          message: 'Failed to update API key.',
        }),
      status: 500,
      message: 'Interner Serverfehler',
      retryAfter: null,
    },
  ] as const) {
    it(label, async () => {
      sessionState.error = error()
      const ctx = buildContext('/api/transactions', '', {
        headers: apiKeyHeaders,
      })
      const res = await onRequest(ctx, next)
      expect(res.status).toBe(status)
      expect(await res.json()).toEqual({ error: message })
      expect(res.headers.get('Retry-After')).toBe(retryAfter)
      expect(ctx.locals.user).toBeUndefined()
      expect(ctx.locals.session).toBeUndefined()
    })
  }

  it('returns 401 when the session lookup resolves to null', async () => {
    sessionState.value = null
    const ctx = buildContext('/api/transactions', '', {
      headers: apiKeyHeaders,
    })
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Ungültiger API-Schlüssel' })
  })

  it('rejects page routes with 403', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: true },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/plans', '', { headers: apiKeyHeaders })
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'API-Schlüssel sind nur für API-Endpunkte gültig',
    })
    expect(sessionState.callCount).toBe(0)
  })

  for (const [label, value] of [
    ['empty', ''],
    ['whitespace-only', '   '],
  ] as const) {
    it(`treats an ${label} x-api-key header as absent and keeps the 2FA gate for cookie sessions`, async () => {
      sessionState.value = {
        user: { id: 'u-1', twoFactorEnabled: false },
        session: { id: 's-1' },
      }
      const ctx = buildContext('/api/transactions', '', {
        headers: { 'x-api-key': value },
      })
      const res = await onRequest(ctx, next)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({
        error: '2FA-Einrichtung erforderlich',
      })
      expect(ctx.locals.user).toBeUndefined()
    })
  }

  it('returns 401 for an empty x-api-key header without any session', async () => {
    sessionState.value = null
    const ctx = buildContext('/api/transactions', '', {
      headers: { 'x-api-key': '' },
    })
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Nicht autorisiert' })
  })

  it('does not route blank-key page requests into the API-key path', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: true },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/plans', '', { headers: { 'x-api-key': '' } })
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
    expect(ctx.locals.user).toEqual({ id: 'u-1', twoFactorEnabled: true })
  })

  it('rejects a key whose user is banned with 403 and attaches no locals', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: true, banned: true },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/api/transactions', '', {
      headers: apiKeyHeaders,
    })
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Benutzerkonto ist gesperrt' })
    expect(ctx.locals.user).toBeUndefined()
    expect(ctx.locals.session).toBeUndefined()
    expect(ctx.locals.userSettings).toBeUndefined()
  })

  for (const [label, banned] of [
    ['banned: false', false],
    ['banned: null', null],
  ] as const) {
    it(`allows a key whose user has ${label}`, async () => {
      sessionState.value = {
        user: { id: 'u-1', twoFactorEnabled: false, banned },
        session: { id: 's-1' },
      }
      const ctx = buildContext('/api/transactions', '', {
        headers: apiKeyHeaders,
      })
      const res = await onRequest(ctx, next)
      expect(res).toBe(nextSentinel)
      expect(ctx.locals.user).toEqual({
        id: 'u-1',
        twoFactorEnabled: false,
        banned,
      })
      expect(ctx.locals.session).toEqual({ id: 's-1' })
    })
  }

  it('allows a key whose session carries no banned field at all', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: false },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/api/accounts', '', { headers: apiKeyHeaders })
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
    expect(ctx.locals.user).toEqual({ id: 'u-1', twoFactorEnabled: false })
  })

  it('rejects GET /api/auth/api-key/list with 403', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: true },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/api/auth/api-key/list', '', {
      headers: apiKeyHeaders,
    })
    const res = await onRequest(ctx, next)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'API-Schlüssel sind nur für API-Endpunkte gültig',
    })
    expect(sessionState.callCount).toBe(0)
  })
})

describe('onRequest middleware — API-Key-Verwaltung', () => {
  for (const [method, pathname] of [
    ['POST', '/api/auth/api-key/create'],
    ['GET', '/api/auth/api-key/list'],
    ['POST', '/api/auth/api-key/delete'],
  ] as const) {
    it(`blocks ${method} ${pathname} for a cookie session without 2FA`, async () => {
      sessionState.value = {
        user: { id: 'u-1', twoFactorEnabled: false },
        session: { id: 's-1' },
      }
      const ctx = buildContext(pathname, '', { method })
      const res = await onRequest(ctx, next)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({
        error: '2FA-Einrichtung erforderlich',
      })
    })

    it(`allows ${method} ${pathname} for a cookie session with 2FA`, async () => {
      sessionState.value = {
        user: { id: 'u-1', twoFactorEnabled: true },
        session: { id: 's-1' },
      }
      const ctx = buildContext(pathname, '', { method })
      const res = await onRequest(ctx, next)
      expect(res).toBe(nextSentinel)
    })
  }

  it('passes unauthenticated key-management calls to better-auth', async () => {
    sessionState.value = null
    const ctx = buildContext('/api/auth/api-key/create', '', { method: 'POST' })
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
  })

  it('passes the request through when the session lookup throws', async () => {
    sessionState.error = new Error('INVALID_API_KEY')
    const ctx = buildContext('/api/auth/api-key/create', '', { method: 'POST' })
    const res = await onRequest(ctx, next)
    expect(res).toBe(nextSentinel)
  })

  it('does not attach locals for key-management routes', async () => {
    sessionState.value = {
      user: { id: 'u-1', twoFactorEnabled: true },
      session: { id: 's-1' },
    }
    const ctx = buildContext('/api/auth/api-key/list')
    await onRequest(ctx, next)
    expect(ctx.locals.user).toBeUndefined()
    expect(ctx.locals.session).toBeUndefined()
  })
})
