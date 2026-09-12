import { expect, it } from 'bun:test'
import { buildApiContext } from './api-context'
import { seedTransactionPreset, seedUser } from './seeds'
import type { TestDatabase } from './test-setup'

type RouteHandler = (context: never) => Promise<Response> | Response

/**
 * Shared UUID constants for the authenticated preset route tests. They are stable
 * v4-shaped strings so the same `presetId` / `planId` can be reused across the
 * `presets/[id]`, `presets/[id]/apply`, and `presets/bulk-apply` suites.
 */
export const PRESET_ROUTE_IDS = {
  userId: '11111111-1111-4111-8111-111111111111',
  otherUserId: '22222222-2222-4222-8222-222222222222',
  presetId: '33333333-3333-4333-8333-333333333333',
  planId: '44444444-4444-4444-8444-444444444444',
} as const

/** Seed two authenticated users who share access to all presets. */
export async function seedPresetUsers(db: TestDatabase): Promise<void> {
  await seedUser(db, {
    id: PRESET_ROUTE_IDS.userId,
    name: 'A',
    email: 'a@e.com',
  })
  await seedUser(db, {
    id: PRESET_ROUTE_IDS.otherUserId,
    name: 'B',
    email: 'b@e.com',
  })
}

/** Seed a preset with its creator retained as metadata. */
export function seedSharedPreset(
  db: TestDatabase,
  id: string,
  creatorId: string = PRESET_ROUTE_IDS.userId,
  name: string = id,
): Promise<string> {
  return seedTransactionPreset(db, {
    id,
    name,
    type: 'expense',
    amount: 1000,
    recurrence: 'monatlich',
    userId: creatorId,
    isBudget: false,
  })
}

/**
 * Registers authentication, missing-ID, and missing-resource checks shared by
 * authenticated `/[id]` preset routes. Call inside the route's `describe` block.
 */
export function itGuardsPresetRoute(
  handler: RouteHandler,
  opts: {
    method: string
    userId: string
    id: string
    body?: unknown
    notFoundName?: string
  },
): void {
  const {
    method,
    userId,
    id,
    body,
    notFoundName = 'returns 404 when not found',
  } = opts

  it('returns 401 when no user', async () => {
    const res = (await handler(
      buildApiContext({ method, body, params: { id } }) as never,
    )) as Response
    expect(res.status).toBe(401)
  })

  it('returns 400 when preset ID is missing', async () => {
    const res = (await handler(
      buildApiContext({ method, body, params: {}, userId }) as never,
    )) as Response
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Preset-ID fehlt' })
  })

  it(notFoundName, async () => {
    const res = (await handler(
      buildApiContext({ method, body, params: { id }, userId }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })
}
