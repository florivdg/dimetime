import { expect, it } from 'bun:test'
import { buildApiContext } from './api-context'
import { seedTransactionPreset, seedUser } from './seeds'
import type { TestDatabase } from './test-setup'

type RouteHandler = (context: never) => Promise<Response> | Response

/**
 * Shared UUID constants for the user-scoped preset route tests. They are stable
 * v4-shaped strings so the same `presetId` / `planId` can be reused across the
 * `presets/[id]`, `presets/[id]/apply`, and `presets/bulk-apply` suites.
 */
export const USER_SCOPED_IDS = {
  userId: '11111111-1111-4111-8111-111111111111',
  otherUserId: '22222222-2222-4222-8222-222222222222',
  presetId: '33333333-3333-4333-8333-333333333333',
  planId: '44444444-4444-4444-8444-444444444444',
} as const

/** Seed the owner + a second "other" user shared by the preset route suites. */
export async function seedScopedUsers(db: TestDatabase): Promise<void> {
  await seedUser(db, {
    id: USER_SCOPED_IDS.userId,
    name: 'A',
    email: 'a@e.com',
  })
  await seedUser(db, {
    id: USER_SCOPED_IDS.otherUserId,
    name: 'B',
    email: 'b@e.com',
  })
}

/** Seed a single preset owned by `owner`, matching the shared fixture shape. */
export function seedScopedPreset(
  db: TestDatabase,
  id: string,
  owner: string = USER_SCOPED_IDS.userId,
  name: string = id,
): Promise<string> {
  return seedTransactionPreset(db, {
    id,
    name,
    type: 'expense',
    amount: 1000,
    recurrence: 'monatlich',
    userId: owner,
    isBudget: false,
  })
}

/**
 * Registers the shared "returns 403 for foreign owner" test: seed a preset owned
 * by `otherUserId`, then call the handler as `userId` and expect a 403. The
 * preset is seeded with `seedScopedPreset` (db passed in) before the request.
 */
export function itRejectsForeignOwner(
  db: TestDatabase,
  handler: RouteHandler,
  opts: { method: string; body?: unknown; name?: string },
): void {
  const { method, body, name = 'returns 403 for foreign owner' } = opts
  const { userId, otherUserId, presetId } = USER_SCOPED_IDS

  it(name, async () => {
    await seedScopedPreset(db, presetId, otherUserId)
    const res = (await handler(
      buildApiContext({
        method,
        body,
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })
}

/**
 * Registers the two guard tests shared by every user-scoped `/[id]` preset
 * route: a 401 when no authenticated user is present, and a 404 when the
 * authenticated user targets a preset that does not exist. Call it inside the
 * route's `describe(...)` block.
 */
export function itGuardsUserScopedRoute(
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

  it(notFoundName, async () => {
    const res = (await handler(
      buildApiContext({ method, body, params: { id }, userId }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })
}
