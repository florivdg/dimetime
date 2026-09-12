import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itUpdatesViaPut } from '@/lib/__fixtures__/route-guards'
import {
  itGuardsPresetRoute,
  seedSharedPreset,
  seedPresetUsers,
  PRESET_ROUTE_IDS,
} from '@/lib/__fixtures__/preset-routes'

const testDb = setupTestDb()

const { PUT, DELETE } = await import('./[id]')

const { userId, otherUserId, presetId } = PRESET_ROUTE_IDS
const { getPresetById } = await import('@/lib/presets')

async function seedPreset() {
  await seedSharedPreset(testDb, presetId, userId)
}

beforeEach(async () => {
  await seedPresetUsers(testDb)
})

describe('PUT /api/presets/[id]', () => {
  itGuardsPresetRoute(PUT, {
    method: 'PUT',
    userId,
    id: presetId,
    body: { name: 'X' },
  })

  it('updates a preset created by another authenticated user', async () => {
    await seedSharedPreset(testDb, presetId, otherUserId)
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'Shared rent' },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    expect(await getPresetById(presetId)).toMatchObject({
      name: 'Shared rent',
      userId: otherUserId,
    })
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
  itGuardsPresetRoute(DELETE, { method: 'DELETE', userId, id: presetId })

  it('deletes a preset created by another authenticated user', async () => {
    await seedSharedPreset(testDb, presetId, otherUserId)
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    expect(await getPresetById(presetId)).toBeUndefined()
  })

  it('deletes a preset created by the requesting user', async () => {
    await seedPreset()
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    expect(await getPresetById(presetId)).toBeUndefined()
  })
})
