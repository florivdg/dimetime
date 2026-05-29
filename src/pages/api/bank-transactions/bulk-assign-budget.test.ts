import { beforeEach, describe, expect, it } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { postExpectCount } from '@/lib/__fixtures__/bulk-route-assertions'
import {
  BULK_ASSIGN_IDS,
  seedBankTransactionSplit,
  seedPlan,
  seedPlannedTransaction,
  seedSourceWithBankTransaction,
} from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { POST } = await import('./bulk-assign-budget')

const planA = '11111111-1111-4111-8111-111111111111'
const planB = '22222222-2222-4222-8222-222222222222'
const { btId } = BULK_ASSIGN_IDS
const budgetId = '55555555-5555-4555-8555-555555555555'
const notBudgetId = '66666666-6666-4666-8666-666666666666'

async function seedBudgetTx(id: string, isBudget: boolean) {
  await seedPlannedTransaction(testDb, {
    id,
    name: isBudget ? 'B' : 'N',
    type: 'expense',
    dueDate: '2026-03-05',
    amount: 0,
    isBudget,
    planId: planA,
  })
}

async function seed() {
  await seedPlan(testDb, { id: planA, date: '2026-03-01', isArchived: false })
  await seedPlan(testDb, { id: planB, date: '2026-04-01', isArchived: false })
  await seedBudgetTx(budgetId, true)
  await seedBudgetTx(notBudgetId, false)
  await seedSourceWithBankTransaction(testDb, {
    txOverrides: { planId: planA, planAssignment: 'manual' },
  })
}

/** Flag `btId` as split and seed one split row (`splitId`) on the given plan. */
async function seedSplitOnBt(splitId: string, planId: string) {
  await testDb
    .update(plansSchema.bankTransaction)
    .set({ isSplit: true })
    .where(
      (await import('drizzle-orm')).eq(plansSchema.bankTransaction.id, btId),
    )
  await seedBankTransactionSplit(testDb, {
    id: splitId,
    bankTransactionId: btId,
    amountCents: -500,
    planId,
  })
}

beforeEach(async () => {
  await seed()
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
    await postExpectCount(POST, { budgetId, ids: [btId] }, 1)
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

  it('assigns budget to splits whose plan matches', async () => {
    const splitId = '77777777-7777-4777-8777-777777777777'
    await seedSplitOnBt(splitId, planA)
    await postExpectCount(POST, { budgetId, ids: [], splitIds: [splitId] }, 1)
  })

  it('returns 400 when split plan differs from budget plan', async () => {
    const splitId = '88888888-8888-4888-8888-888888888888'
    await seedSplitOnBt(splitId, planB)

    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { budgetId, ids: [], splitIds: [splitId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })
})
