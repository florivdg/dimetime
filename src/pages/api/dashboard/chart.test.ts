import { describe, expect, it } from 'bun:test'
import { monthOffsetDate } from '@/lib/__fixtures__/dates'
import { seedPlan, seedPlannedTransaction } from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const testDb = setupTestDb()

const { GET } = await import('./chart')

/** Seeds a plan dated `date` plus one transaction in it, due on `dueDate`. */
async function seedTx(
  date: string,
  amount: number,
  type: 'income' | 'expense',
  dueDate = date,
) {
  await seedPlan(testDb, { id: `p-${date}`, date, isArchived: false })
  await seedPlannedTransaction(testDb, {
    id: `t-${date}-${type}`,
    name: 'tx',
    type,
    dueDate,
    amount,
    isDone: false,
    isBudget: false,
    planId: `p-${date}`,
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
    await seedTx(monthOffsetDate(0, '01'), 50000, 'income')
    const res = (await GET(
      buildApiContext({ url: 'http://test/api/dashboard/chart' }) as never,
    )) as Response
    const body = await res.json()
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data.at(-1).income).toBe(50000)
  })

  it('counts a transaction in its plan month, not in its due date month', async () => {
    await seedTx(
      monthOffsetDate(0, '01'),
      12345,
      'expense',
      monthOffsetDate(-1),
    )

    const res = (await GET(
      buildApiContext({ url: 'http://test/api/dashboard/chart' }) as never,
    )) as Response
    const body = await res.json()
    expect(body.data.length).toBe(1)
    expect(body.data.at(-1).expense).toBe(12345)
  })
})
