import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import {
  postExpectCreated,
  postExpectStatus,
} from '@/lib/__fixtures__/bulk-route-assertions'
import { seedPlan, seedUser } from '@/lib/__fixtures__/seeds'
import { seedScopedPreset } from '@/lib/__fixtures__/route-guards-user'

const testDb = setupTestDb()

const { POST } = await import('./bulk-apply')

const userId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const planId = '33333333-3333-4333-8333-333333333333'
const archivedPlanId = '44444444-4444-4444-8444-444444444444'
const preset1 = '55555555-5555-4555-8555-555555555555'
const preset2 = '66666666-6666-4666-8666-666666666666'

async function seedAll() {
  await seedUser(testDb, { id: userId, name: 'A', email: 'a@e.com' })
  await seedUser(testDb, { id: otherUserId, name: 'B', email: 'b@e.com' })
  await seedPlan(testDb, { id: planId, date: '2026-03-01', isArchived: false })
  await seedPlan(testDb, {
    id: archivedPlanId,
    date: '2026-02-01',
    isArchived: true,
  })
}

async function seedPreset(id: string, owner = userId) {
  await seedScopedPreset(testDb, id, owner)
}

beforeEach(async () => {
  await seedAll()
})

describe('POST /api/presets/bulk-apply', () => {
  it('returns 401 when no user', async () => {
    await postExpectStatus(
      POST,
      { body: { planId, presetIds: [preset1] } },
      401,
    )
  })

  it('rejects invalid body', async () => {
    await postExpectStatus(POST, { body: {}, userId }, 400)
  })

  it('returns 400 when target plan archived', async () => {
    await seedPreset(preset1)
    await postExpectStatus(
      POST,
      { body: { planId: archivedPlanId, presetIds: [preset1] }, userId },
      400,
    )
  })

  it('returns 404 when one of the presets is missing', async () => {
    await seedPreset(preset1)
    await postExpectStatus(
      POST,
      { body: { planId, presetIds: [preset1, preset2] }, userId },
      404,
    )
  })

  it('returns 403 when a preset is owned by another user', async () => {
    await seedPreset(preset1)
    await seedPreset(preset2, otherUserId)
    await postExpectStatus(
      POST,
      { body: { planId, presetIds: [preset1, preset2] }, userId },
      403,
    )
  })

  it('applies presets and returns 201', async () => {
    await seedPreset(preset1)
    await seedPreset(preset2)
    const body = await postExpectCreated(POST, {
      body: { planId, presetIds: [preset1, preset2] },
      userId,
    })
    expect(body.count).toBe(2)
  })
})
