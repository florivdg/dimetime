import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { PATCH, DELETE } = await import('./[id]')

const now = new Date('2026-03-09T00:00:00.000Z')
const planId = '11111111-1111-4111-8111-111111111111'
const archivedPlanId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'
const btId = '44444444-4444-4444-8444-444444444444'
const budgetId = '55555555-5555-4555-8555-555555555555'

async function seedBase() {
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

async function seedBankTx() {
  await testDb.insert(plansSchema.bankTransaction).values({
    id: btId,
    sourceId,
    dedupeKey: 'k1',
    bookingDate: '2026-03-01',
    amountCents: -1000,
    currency: 'EUR',
    status: 'booked',
    rawDataJson: '{}',
    isArchived: false,
    isSplit: false,
    importSeenCount: 1,
    planAssignment: 'none',
    createdAt: now,
    updatedAt: now,
  })
}

async function seedBudget() {
  await testDb.insert(plansSchema.plannedTransaction).values({
    id: budgetId,
    name: 'Budget',
    type: 'expense',
    dueDate: '2026-03-05',
    amount: 0,
    isBudget: true,
    planId,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  harness.reset()
  await seedBase()
})

afterAll(() => {
  harness.close()
})

describe('PATCH /api/bank-transactions/[id]', () => {
  it('returns 400 when id missing', async () => {
    const res = (await PATCH(
      buildApiContext({
        method: 'PATCH',
        body: { note: 'x' },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when not found', async () => {
    const res = (await PATCH(
      buildApiContext({
        method: 'PATCH',
        body: { note: 'x' },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('rejects empty body (refine: at least one field)', async () => {
    await seedBankTx()
    const res = (await PATCH(
      buildApiContext({
        method: 'PATCH',
        body: {},
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects assignment to archived plan', async () => {
    await seedBankTx()
    const res = (await PATCH(
      buildApiContext({
        method: 'PATCH',
        body: { planId: archivedPlanId },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('updates note successfully', async () => {
    await seedBankTx()
    const res = (await PATCH(
      buildApiContext({
        method: 'PATCH',
        body: { note: 'memo' },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.note).toBe('memo')
  })

  it('returns 400 when budget plan mismatches effective plan', async () => {
    await seedBankTx()
    await seedBudget()
    // Assign a different plan but try to set the budget (which belongs to planId)
    const otherPlanId = '99999999-9999-4999-8999-999999999999'
    await testDb.insert(plansSchema.plan).values({
      id: otherPlanId,
      date: '2026-04-01',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })
    const res = (await PATCH(
      buildApiContext({
        method: 'PATCH',
        body: { planId: otherPlanId, budgetId },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/bank-transactions/[id]', () => {
  it('returns 400 when id missing', async () => {
    const res = (await DELETE(
      buildApiContext({ method: 'DELETE' }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when not found', async () => {
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('deletes successfully', async () => {
    await seedBankTx()
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
