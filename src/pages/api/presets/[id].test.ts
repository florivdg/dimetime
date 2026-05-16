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

const { PUT, DELETE } = await import('./[id]')

const now = new Date('2026-03-09T00:00:00.000Z')
const userId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const presetId = '33333333-3333-4333-8333-333333333333'

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

beforeEach(async () => {
  harness.reset()
  await seedUsers()
})

afterAll(() => {
  harness.close()
})

describe('PUT /api/presets/[id]', () => {
  it('returns 401 when no user', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
        params: { id: presetId },
      }) as never,
    )) as Response
    expect(res.status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 403 when owned by another user', async () => {
    await seedPreset(otherUserId)
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })

  it('rejects invalid body', async () => {
    await seedPreset()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { startMonth: '2026/03' },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('updates and returns the preset', async () => {
    await seedPreset()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'Renamed' },
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Renamed')
  })
})

describe('DELETE /api/presets/[id]', () => {
  it('returns 403 for foreign owner', async () => {
    await seedPreset(otherUserId)
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: presetId },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })

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
