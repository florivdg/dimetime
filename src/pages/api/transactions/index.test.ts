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
const planId = '11111111-1111-4111-8111-111111111111'
const archivedPlanId = '22222222-2222-4222-8222-222222222222'
const userId = '33333333-3333-4333-8333-333333333333'

async function seed() {
  await testDb.insert(authSchema.user).values({
    id: userId,
    name: 'A',
    email: 'a@example.com',
    createdAt: now,
    updatedAt: now,
  })
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

beforeEach(async () => {
  harness.reset()
  await seed()
})

afterAll(() => {
  harness.close()
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
    await testDb.insert(plansSchema.plannedTransaction).values({
      id: 't-1',
      name: 'Test',
      type: 'expense',
      dueDate: '2026-03-15',
      amount: 1000,
      planId,
      createdAt: now,
      updatedAt: now,
    })
    const res = (await GET(buildApiContext({ userId }) as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.transactions.length).toBe(1)
    expect(body.budgetSpending).toEqual({})
  })

  it('includes budget spending for budget rows', async () => {
    await testDb.insert(plansSchema.plannedTransaction).values({
      id: 'budget-1',
      name: 'Budget',
      type: 'expense',
      dueDate: '2026-03-15',
      amount: 5000,
      isBudget: true,
      planId,
      createdAt: now,
      updatedAt: now,
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
