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

const { POST } = await import('./apply')

const now = new Date('2026-03-09T00:00:00.000Z')
const userId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const presetId = '33333333-3333-4333-8333-333333333333'
const planId = '44444444-4444-4444-8444-444444444444'

async function seedUsers() {
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
}

async function seedPreset(owner = userId) {
  await testDb.insert(plansSchema.transactionPreset).values({
    id: presetId,
    name: 'Rent',
    type: 'expense',
    amount: 1000,
    recurrence: 'monatlich',
    userId: owner,
    isBudget: false,
    createdAt: now,
    updatedAt: now,
  })
}

async function seedPlan() {
  await testDb.insert(plansSchema.plan).values({
    id: planId,
    date: '2026-03-01',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  harness.reset()
  await seedUsers()
})

afterAll(() => {
  harness.close()
})

describe('POST /api/presets/[id]/apply', () => {
  it('returns 401 when no user', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId },
        params: { id: presetId },
      }) as never,
    )) as Response
    expect(res.status).toBe(401)
  })

  it('returns 404 when preset missing', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 403 for foreign owner', async () => {
    await seedPreset(otherUserId)
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })

  it('rejects invalid body', async () => {
    await seedPreset()
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId: 'not-a-uuid' },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 500 when plan does not exist (lib throws)', async () => {
    await seedPreset()
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    // applyPresetToPlan throws inside handle => 500 with the error message
    expect(res.status).toBe(500)
  })

  it('applies preset and returns 201', async () => {
    await seedPreset()
    await seedPlan()
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Rent')
  })
})
