import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itUpdatesViaPut } from '@/lib/__fixtures__/route-guards'
import {
  itGuardsUserScopedRoute,
  itRejectsForeignOwner,
  seedScopedPreset,
  seedScopedUsers,
  USER_SCOPED_IDS,
} from '@/lib/__fixtures__/route-guards-user'

const testDb = setupTestDb()

const { PUT, DELETE } = await import('./[id]')

const { userId, presetId } = USER_SCOPED_IDS

async function seedPreset() {
  await seedScopedPreset(testDb, presetId, userId)
}

beforeEach(async () => {
  await seedScopedUsers(testDb)
})

describe('PUT /api/presets/[id]', () => {
  itGuardsUserScopedRoute(PUT, {
    method: 'PUT',
    userId,
    id: presetId,
    body: { name: 'X' },
  })

  itRejectsForeignOwner(testDb, PUT, {
    method: 'PUT',
    body: { name: 'X' },
    name: 'returns 403 when owned by another user',
  })

  itUpdatesViaPut(PUT, {
    seed: seedPreset,
    id: presetId,
    invalidBody: { startMonth: '2026/03' },
    resourceName: 'preset',
    userId,
  })
})

describe('DELETE /api/presets/[id]', () => {
  itRejectsForeignOwner(testDb, DELETE, { method: 'DELETE' })

  it('returns 404 when not found', async () => {
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('deletes for the owner', async () => {
    await seedPreset()
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
