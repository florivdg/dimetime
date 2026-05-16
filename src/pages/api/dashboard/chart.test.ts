import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { GET } = await import('./chart')

const now = new Date('2026-03-09T00:00:00.000Z')

beforeEach(() => {
  harness.reset()
})

afterAll(() => {
  harness.close()
})

async function seedTx(
  date: string,
  amount: number,
  type: 'income' | 'expense',
) {
  await testDb.insert(plansSchema.plan).values({
    id: `p-${date}`,
    date,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  })
  await testDb.insert(plansSchema.plannedTransaction).values({
    id: `t-${date}-${type}`,
    name: 'tx',
    type,
    dueDate: date,
    amount,
    isDone: false,
    isBudget: false,
    planId: `p-${date}`,
    createdAt: now,
    updatedAt: now,
  })
}

describe('GET /api/dashboard/chart', () => {
  it('returns chart data for the default range (6m) when none specified', async () => {
    const res = (await GET(
      buildApiContext({ url: 'http://test/api/dashboard/chart' }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('respects valid range=12m', async () => {
    const res = (await GET(
      buildApiContext({
        url: 'http://test/api/dashboard/chart?range=12m',
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })

  it('respects valid range=year', async () => {
    const res = (await GET(
      buildApiContext({
        url: 'http://test/api/dashboard/chart?range=year',
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })

  it('falls back to 6m for invalid range values', async () => {
    const res = (await GET(
      buildApiContext({
        url: 'http://test/api/dashboard/chart?range=bogus',
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })

  it('includes seeded data points in the response', async () => {
    const today = new Date()
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`
    await seedTx(ym, 50000, 'income')
    const res = (await GET(
      buildApiContext({ url: 'http://test/api/dashboard/chart' }) as never,
    )) as Response
    const body = await res.json()
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data.at(-1).income).toBe(50000)
  })
})
