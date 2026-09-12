import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { plannedTransaction, transactionPreset } from '@/db/schema/plans'
import {
  postExpectCreated,
  postExpectStatus,
} from '@/lib/__fixtures__/bulk-route-assertions'
import { seedPlan as seedPlanFixture } from '@/lib/__fixtures__/seeds'
import {
  itGuardsPresetRoute,
  seedSharedPreset,
  seedPresetUsers,
  PRESET_ROUTE_IDS,
} from '@/lib/__fixtures__/preset-routes'

const testDb = setupTestDb()

const { POST } = await import('./apply')

const { userId, otherUserId, presetId, planId } = PRESET_ROUTE_IDS

async function seedPreset() {
  await seedSharedPreset(testDb, presetId, userId, 'Rent')
}

async function seedPlan(isArchived = false) {
  await seedPlanFixture(testDb, {
    id: planId,
    date: '2026-03-01',
    isArchived,
  })
}

beforeEach(async () => {
  await seedPresetUsers(testDb)
})

describe('POST /api/presets/[id]/apply', () => {
  itGuardsPresetRoute(POST, {
    method: 'POST',
    userId,
    id: presetId,
    body: { planId },
    notFoundName: 'returns 404 when preset missing',
  })

  it('applies a preset created by another user and persists its transaction', async () => {
    await seedSharedPreset(testDb, presetId, otherUserId, 'Shared rent')
    await seedPlan()
    const body = await postExpectCreated(POST, {
      body: { planId, dueDate: '2026-03-15' },
      params: { id: presetId },
      userId,
    })
    expect(await testDb.select().from(plannedTransaction)).toEqual([
      expect.objectContaining({
        id: body.id,
        name: 'Shared rent',
        planId,
        dueDate: '2026-03-15',
        amount: 1000,
      }),
    ])
    const [preset] = await testDb.select().from(transactionPreset)
    expect(preset.userId).toBe(otherUserId)
    expect(preset.lastUsedAt).toBeInstanceOf(Date)
  })

  it('rejects invalid body', async () => {
    await seedPreset()
    await postExpectStatus(
      POST,
      { body: { planId: 'not-a-uuid' }, params: { id: presetId }, userId },
      400,
    )
  })

  it.each([
    { name: 'missing', status: 404, error: 'Plan nicht gefunden' },
    { name: 'archived', status: 400, error: 'Plan ist archiviert' },
  ])(
    'rejects a $name target plan without mutating data',
    async ({ name, status, error }) => {
      await seedPreset()
      if (name === 'archived') await seedPlan(true)
      const res = (await POST(
        buildApiContext({
          method: 'POST',
          body: { planId },
          params: { id: presetId },
          userId,
        }) as never,
      )) as Response
      expect(res.status).toBe(status)
      expect(await res.json()).toEqual({ error })
      expect(await testDb.select().from(plannedTransaction)).toEqual([])
      const [preset] = await testDb.select().from(transactionPreset)
      expect(preset.lastUsedAt).toBeNull()
    },
  )

  it('applies preset and returns 201', async () => {
    await seedPreset()
    await seedPlan()
    const body = await postExpectCreated(POST, {
      body: { planId },
      params: { id: presetId },
      userId,
    })
    expect(body.name).toBe('Rent')
  })
})
