import { beforeEach, describe, expect, it } from 'bun:test'
import {
  seedPlan,
  seedPlannedTransaction,
  seedUser,
} from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { getExpectOkBody } from '@/lib/__fixtures__/bulk-route-assertions'

const testDb = setupTestDb()

const { GET, POST } = await import('./index')

const planId = '11111111-1111-4111-8111-111111111111'
const archivedPlanId = '22222222-2222-4222-8222-222222222222'
const userId = '33333333-3333-4333-8333-333333333333'

async function seed() {
  await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
  await seedPlan(testDb, { id: planId, date: '2026-03-01', isArchived: false })
  await seedPlan(testDb, {
    id: archivedPlanId,
    date: '2026-02-01',
    isArchived: true,
  })
}

beforeEach(async () => {
  await seed()
})

describe('GET /api/transactions', () => {
  it('rejects invalid limit', async () => {
    const res = (await GET(
      buildApiContext({
        url: 'http://test/api/transactions?limit=500',
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns paginated transactions', async () => {
    await seedPlannedTransaction(testDb, {
      id: 't-1',
      name: 'Test',
      type: 'expense',
      dueDate: '2026-03-15',
      amount: 1000,
      planId,
    })
    const body = await getExpectOkBody(GET, userId)
    expect(body.transactions.length).toBe(1)
    expect(body.budgetSpending).toEqual({})
  })

  it('includes budget spending for budget rows', async () => {
    await seedPlannedTransaction(testDb, {
      id: 'budget-1',
      name: 'Budget',
      type: 'expense',
      dueDate: '2026-03-15',
      amount: 5000,
      isBudget: true,
      planId,
    })
    const res = (await GET(buildApiContext({ userId }) as never)) as Response
    const body = await res.json()
    expect(body.budgetSpending).toBeDefined()
  })
})

describe('POST /api/transactions', () => {
  it('rejects missing planId', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { name: 'X', dueDate: '2026-03-01', amount: 100 },
      }) as never,
    )) as Response
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects when target plan is archived', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          name: 'X',
          dueDate: '2026-02-15',
          amount: 100,
          planId: archivedPlanId,
        },
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })

  it('returns 404 when target plan does not exist', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          name: 'X',
          dueDate: '2026-03-01',
          amount: 100,
          planId: '99999999-9999-4999-8999-999999999999',
        },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('creates and returns 201', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          name: 'New',
          dueDate: '2026-03-15',
          amount: 5000,
          planId,
        },
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('New')
  })
})
