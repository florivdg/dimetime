import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as authSchema from '@/db/schema/auth'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { POST } = await import('./bulk-apply')

const now = new Date('2026-03-09T00:00:00.000Z')
const userId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const planId = '33333333-3333-4333-8333-333333333333'
const archivedPlanId = '44444444-4444-4444-8444-444444444444'
const preset1 = '55555555-5555-4555-8555-555555555555'
const preset2 = '66666666-6666-4666-8666-666666666666'

async function seedAll() {
  await testDb.insert(authSchema.user).values([
    { id: userId, name: 'A', email: 'a@e.com', createdAt: now, updatedAt: now },
    {
      id: otherUserId,
      name: 'B',
      email: 'b@e.com',
      createdAt: now,
      updatedAt: now,
    },
  ])
  await testDb.insert(plansSchema.plan).values([
    {
      id: planId,
      date: '2026-03-01',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: archivedPlanId,
      date: '2026-02-01',
      isArchived: true,
      createdAt: now,
      updatedAt: now,
    },
  ])
}

async function seedPreset(id: string, owner = userId) {
  await testDb.insert(plansSchema.transactionPreset).values({
    id,
    name: id,
    type: 'expense',
    amount: 1000,
    recurrence: 'monatlich',
    userId: owner,
    isBudget: false,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  harness.reset()
  await seedAll()
})

afterAll(() => {
  harness.close()
})

describe('POST /api/presets/bulk-apply', () => {
  it('returns 401 when no user', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId, presetIds: [preset1] },
      }) as never,
    )) as Response
    expect(res.status).toBe(401)
  })

  it('rejects invalid body', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {},
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 400 when target plan archived', async () => {
    await seedPreset(preset1)
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId: archivedPlanId, presetIds: [preset1] },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when one of the presets is missing', async () => {
    await seedPreset(preset1)
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId, presetIds: [preset1, preset2] },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 403 when a preset is owned by another user', async () => {
    await seedPreset(preset1)
    await seedPreset(preset2, otherUserId)
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId, presetIds: [preset1, preset2] },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })

  it('applies presets and returns 201', async () => {
    await seedPreset(preset1)
    await seedPreset(preset2)
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId, presetIds: [preset1, preset2] },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.count).toBe(2)
  })
})
