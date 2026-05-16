import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { POST } = await import('./bulk-assign-budget')

const now = new Date('2026-03-09T00:00:00.000Z')
const planA = '11111111-1111-4111-8111-111111111111'
const planB = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'
const btId = '44444444-4444-4444-8444-444444444444'
const budgetId = '55555555-5555-4555-8555-555555555555'
const notBudgetId = '66666666-6666-4666-8666-666666666666'

async function seed() {
  await testDb.insert(plansSchema.importSource).values({
    id: sourceId,
    name: 'S',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
  await testDb.insert(plansSchema.plan).values([
    {
      id: planA,
      date: '2026-03-01',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: planB,
      date: '2026-04-01',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
  ])
  await testDb.insert(plansSchema.plannedTransaction).values([
    {
      id: budgetId,
      name: 'B',
      type: 'expense',
      dueDate: '2026-03-05',
      amount: 0,
      isBudget: true,
      planId: planA,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: notBudgetId,
      name: 'N',
      type: 'expense',
      dueDate: '2026-03-05',
      amount: 0,
      isBudget: false,
      planId: planA,
      createdAt: now,
      updatedAt: now,
    },
  ])
  await testDb.insert(plansSchema.bankTransaction).values({
    id: btId,
    sourceId,
    dedupeKey: 'k1',
    bookingDate: '2026-03-01',
    amountCents: -1000,
    currency: 'EUR',
    status: 'booked',
    rawDataJson: '{}',
    planId: planA,
    isArchived: false,
    isSplit: false,
    importSeenCount: 1,
    planAssignment: 'manual',
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  harness.reset()
  await seed()
})

afterAll(() => {
  harness.close()
})

describe('POST /api/bank-transactions/bulk-assign-budget', () => {
  it('rejects empty input', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { budgetId: null, ids: [], splitIds: [] },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when budget missing', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          budgetId: '99999999-9999-4999-8999-999999999999',
          ids: [btId],
        },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 400 when target is not a budget', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { budgetId: notBudgetId, ids: [btId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 400 when transaction plan differs from budget plan', async () => {
    // Move bt to planB
    await testDb
      .update(plansSchema.bankTransaction)
      .set({ planId: planB })
      .where(
        (await import('drizzle-orm')).eq(plansSchema.bankTransaction.id, btId),
      )

    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { budgetId, ids: [btId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('assigns the budget when plans match', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { budgetId, ids: [btId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(1)
  })

  it('clears budget when budgetId=null', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { budgetId: null, ids: [btId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
