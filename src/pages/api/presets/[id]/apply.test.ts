import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import {
  postExpectCreated,
  postExpectStatus,
} from '@/lib/__fixtures__/bulk-route-assertions'
import { seedPlan as seedPlanFixture } from '@/lib/__fixtures__/seeds'
import {
  itGuardsUserScopedRoute,
  itRejectsForeignOwner,
  seedScopedPreset,
  seedScopedUsers,
  USER_SCOPED_IDS,
} from '@/lib/__fixtures__/route-guards-user'

const testDb = setupTestDb()

const { POST } = await import('./apply')

const { userId, presetId, planId } = USER_SCOPED_IDS

async function seedPreset() {
  await seedScopedPreset(testDb, presetId, userId, 'Rent')
}

async function seedPlan() {
  await seedPlanFixture(testDb, {
    id: planId,
    date: '2026-03-01',
    isArchived: false,
  })
}

beforeEach(async () => {
  await seedScopedUsers(testDb)
})

describe('POST /api/presets/[id]/apply', () => {
  itGuardsUserScopedRoute(POST, {
    method: 'POST',
    userId,
    id: presetId,
    body: { planId },
    notFoundName: 'returns 404 when preset missing',
  })

  itRejectsForeignOwner(testDb, POST, { method: 'POST', body: { planId } })

  it('rejects invalid body', async () => {
    await seedPreset()
    await postExpectStatus(
      POST,
      { body: { planId: 'not-a-uuid' }, params: { id: presetId }, userId },
      400,
    )
  })

  it('returns 500 when plan does not exist (lib throws)', async () => {
    await seedPreset()
    // applyPresetToPlan throws inside handle => 500 with the error message
    await postExpectStatus(
      POST,
      { body: { planId }, params: { id: presetId }, userId },
      500,
    )
  })

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
