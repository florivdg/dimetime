import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { getExpectOkBody } from '@/lib/__fixtures__/bulk-route-assertions'
import { seedInstallmentPlan, seedUser } from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { GET } = await import('./overview')

const userId = '11111111-1111-4111-8111-111111111111'

beforeEach(async () => {
  await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
})

describe('GET /api/installments/overview', () => {
  it('returns empty aggregates without installments', async () => {
    const body = await getExpectOkBody(GET, userId)
    expect(body.installments).toEqual([])
    expect(body.aggregates).toEqual({
      currentMonthlyLoad: 0,
      totalRemainingSum: 0,
    })
    expect(body.timeline).toEqual([])
  })

  it('returns the projection for a running installment', async () => {
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      name: 'Sofa',
      amount: 5000,
      totalInstallments: 4,
      startMonth: '2020-01',
      userId,
    })

    const body = await getExpectOkBody(GET, userId)
    expect(body.installments).toHaveLength(1)
    expect(body.aggregates.totalRemainingSum).toBe(20000)
    // The start month is in the past, so the projection starts today
    expect(body.aggregates.currentMonthlyLoad).toBe(5000)
    expect(body.timeline).toHaveLength(4)
    expect(body.timeline[0].total).toBe(5000)
    expect(body.timeline[0].entries[0].name).toBe('Sofa')
  })
})
