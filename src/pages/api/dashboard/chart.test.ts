import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  setSystemTime,
} from 'bun:test'
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
  beforeEach(() => {
    setSystemTime(new Date(2026, 8, 15, 12))
  })
  afterEach(() => setSystemTime())

  it.each([
    ['', ['2026-04', '2026-09']],
    ['?range=6m', ['2026-04', '2026-09']],
    [
      '?range=12m',
      ['2025-10', '2025-12', '2026-01', '2026-03', '2026-04', '2026-09'],
    ],
    ['?range=year', ['2026-01', '2026-03', '2026-04', '2026-09']],
    ['?range=bogus', ['2026-04', '2026-09']],
  ])('returns the exact ordered range for "%s"', async (query, months) => {
    // Deliberately seed out of order, including the month before each cutoff.
    for (const date of [
      '2026-09-01',
      '2025-09-30',
      '2026-03-31',
      '2026-04-01',
      '2025-12-31',
      '2026-01-01',
      '2025-10-01',
    ]) {
      await seedTx(date, 50000, 'income')
    }
    const res = (await GET(
      buildApiContext({
        url: `http://test/api/dashboard/chart${query}`,
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: months.map((month) => ({
        month: `${month}-01T00:00:00.000Z`,
        income: 50000,
        expense: 0,
      })),
    })
  })

  it('includes seeded data points in the response', async () => {
    await seedTx(monthOffsetDate(0, '01'), 50000, 'income')
    const res = (await GET(
      buildApiContext({ url: 'http://test/api/dashboard/chart' }) as never,
    )) as Response
    const body = await res.json()
    expect(body.data).toEqual([
      { month: '2026-09-01T00:00:00.000Z', income: 50000, expense: 0 },
    ])
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
    expect(body.data).toEqual([
      { month: '2026-09-01T00:00:00.000Z', income: 0, expense: 12345 },
    ])
  })
})
