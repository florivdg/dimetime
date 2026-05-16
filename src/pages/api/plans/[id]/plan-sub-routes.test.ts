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

const balanceRoute = await import('./balance')
const budgetsRoute = await import('./budgets')
const budgetSpendingRoute = await import('./budget-spending')
const matchingPresetsRoute = await import('./matching-presets')

const now = new Date('2026-03-09T00:00:00.000Z')
const planId = 'p1'
const userId = 'user-1'

async function seedPlan() {
  await testDb.insert(plansSchema.plan).values({
    id: planId,
    date: '2026-03-01',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  })
}

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

describe('GET /api/plans/[id]/balance', () => {
  it('returns 404 when plan not found', async () => {
    const res = (await balanceRoute.GET(
      buildApiContext({ params: { id: 'missing' } }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns zeroed balance for an empty plan', async () => {
    await seedPlan()
    const res = (await balanceRoute.GET(
      buildApiContext({ params: { id: planId } }) as never,
    )) as Response
    const body = await res.json()
    expect(body).toEqual({ income: 0, expense: 0, net: 0 })
  })

  it('aggregates income vs expense', async () => {
    await seedPlan()
    await testDb.insert(plansSchema.plannedTransaction).values([
      {
        id: 't1',
        name: 'i',
        type: 'income',
        dueDate: '2026-03-05',
        amount: 1000,
        planId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 't2',
        name: 'e',
        type: 'expense',
        dueDate: '2026-03-10',
        amount: 300,
        planId,
        createdAt: now,
        updatedAt: now,
      },
    ])
    const res = (await balanceRoute.GET(
      buildApiContext({ params: { id: planId } }) as never,
    )) as Response
    const body = await res.json()
    expect(body).toEqual({ income: 1000, expense: 300, net: 700 })
  })
})

describe('GET /api/plans/[id]/budgets', () => {
  it('returns 404 when plan missing', async () => {
    const res = (await budgetsRoute.GET(
      buildApiContext({ params: { id: 'missing' } }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns budget transactions for the plan', async () => {
    await seedPlan()
    await testDb.insert(plansSchema.plannedTransaction).values([
      {
        id: 'b1',
        name: 'Groceries',
        type: 'expense',
        dueDate: '2026-03-05',
        amount: 0,
        isBudget: true,
        planId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'b2',
        name: 'Not Budget',
        type: 'expense',
        dueDate: '2026-03-06',
        amount: 0,
        planId,
        createdAt: now,
        updatedAt: now,
      },
    ])
    const res = (await budgetsRoute.GET(
      buildApiContext({ params: { id: planId } }) as never,
    )) as Response
    const body = await res.json()
    expect(body.budgets.map((b: { id: string }) => b.id)).toEqual(['b1'])
  })
})

describe('GET /api/plans/[id]/budget-spending', () => {
  it('returns 400 when id missing', async () => {
    const res = (await budgetSpendingRoute.GET(
      buildApiContext() as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns empty spending object for a fresh plan', async () => {
    await seedPlan()
    const res = (await budgetSpendingRoute.GET(
      buildApiContext({ params: { id: planId } }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.spending).toEqual({})
  })
})

describe('GET /api/plans/[id]/matching-presets', () => {
  it('returns 401 when no user', async () => {
    const res = (await matchingPresetsRoute.GET(
      buildApiContext({ params: { id: planId } }) as never,
    )) as Response
    expect(res.status).toBe(401)
  })

  it('returns 404 when plan missing', async () => {
    const res = (await matchingPresetsRoute.GET(
      buildApiContext({
        userId,
        params: { id: 'missing' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns presets with match status', async () => {
    await seedPlan()
    await testDb.insert(plansSchema.transactionPreset).values({
      id: 'preset-1',
      name: 'Rent',
      type: 'expense',
      amount: 1000,
      recurrence: 'monatlich',
      startMonth: '2026-01',
      userId,
      isBudget: false,
      createdAt: now,
      updatedAt: now,
    })
    const res = (await matchingPresetsRoute.GET(
      buildApiContext({
        userId,
        params: { id: planId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.presets[0].isMatching).toBe(true)
  })
})
