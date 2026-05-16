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

const { GET, POST } = await import('./index')

const now = new Date('2026-03-09T00:00:00.000Z')
const userId = '11111111-1111-4111-8111-111111111111'

async function seedUser() {
  await testDb.insert(authSchema.user).values({
    id: userId,
    name: 'A',
    email: 'a@example.com',
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  harness.reset()
  await seedUser()
})

afterAll(() => {
  harness.close()
})

describe('GET /api/presets', () => {
  it('returns 401 without user', async () => {
    const res = (await GET(buildApiContext() as never)) as Response
    expect(res.status).toBe(401)
  })

  it('returns paginated presets for the user', async () => {
    await testDb.insert(plansSchema.transactionPreset).values({
      id: '11111111-1111-4111-8111-aaaaaaaaaaaa',
      name: 'Rent',
      type: 'expense',
      amount: 1000,
      recurrence: 'monatlich',
      userId,
      isBudget: false,
      createdAt: now,
      updatedAt: now,
    })
    const res = (await GET(buildApiContext({ userId }) as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.presets).toHaveLength(1)
  })

  it('rejects invalid query (limit out of range)', async () => {
    const res = (await GET(
      buildApiContext({
        userId,
        url: 'http://test/api/presets?limit=500',
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })
})

describe('POST /api/presets', () => {
  it('returns 401 without user', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { name: 'X', amount: 100 },
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

  it('creates and returns 201', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { name: 'Rent', amount: 1000 },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Rent')
  })
})
