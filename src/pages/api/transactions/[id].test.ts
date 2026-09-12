import { beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { installmentSkip, plan, plannedTransaction } from '@/db/schema/plans'
import {
  seedBankTransactionSplit,
  seedInstallmentPlan,
  seedPlan,
  seedPlannedTransaction,
  seedSourceWithBankTransaction,
  seedUser,
} from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itGuardsIdRoute } from '@/lib/__fixtures__/route-guards'

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

const testDb = setupTestDb()

const { PUT, DELETE } = await import('./[id]')
const { syncPlansForInstallment } = await import('@/lib/installments')

const planId = '11111111-1111-4111-8111-111111111111'
const otherPlanId = '22222222-2222-4222-8222-222222222222'
const archivedPlanId = '33333333-3333-4333-8333-333333333333'
const txId = '44444444-4444-4444-8444-444444444444'
const userId = '55555555-5555-4555-8555-555555555555'
const installmentId = '66666666-6666-4666-8666-666666666666'
const sourceId = '77777777-7777-4777-8777-777777777777'
const bankTxId = '88888888-8888-4888-8888-888888888888'
const splitId = '99999999-9999-4999-8999-999999999998'

async function seedPlans() {
  await seedPlan(testDb, { id: planId, date: '2026-03-01', isArchived: false })
  await seedPlan(testDb, {
    id: otherPlanId,
    date: '2026-04-01',
    isArchived: false,
  })
  await seedPlan(testDb, {
    id: archivedPlanId,
    date: '2026-02-01',
    isArchived: true,
  })
}

async function seedTx() {
  await seedPlannedTransaction(testDb, {
    id: txId,
    name: 'T',
    type: 'expense',
    dueDate: '2026-03-15',
    amount: 1000,
    planId,
  })
}

/** PUT `body` to the seeded transaction. */
async function putTx(body: Record<string, unknown>) {
  return (await PUT(
    buildApiContext({ method: 'PUT', body, params: { id: txId } }) as never,
  )) as Response
}

/** Seed a budget transaction with one assigned bank transaction and one split. */
async function seedBudgetWithLinks() {
  await seedPlannedTransaction(testDb, {
    id: txId,
    name: 'Budget',
    type: 'expense',
    dueDate: '2026-03-15',
    amount: 1000,
    planId,
    isBudget: true,
  })
  await seedSourceWithBankTransaction(testDb, {
    sourceId,
    btId: bankTxId,
    txOverrides: { planId, budgetId: txId },
  })
  await seedBankTransactionSplit(testDb, {
    id: splitId,
    bankTransactionId: bankTxId,
    planId,
    budgetId: txId,
  })
}

/** Plan ids carrying a row of the installment, oldest plan month first. */
async function linkedPlanIds() {
  const rows = await testDb
    .select({
      planId: plannedTransaction.planId,
      planDate: plan.date,
    })
    .from(plannedTransaction)
    .leftJoin(plan, eq(plannedTransaction.planId, plan.id))
    .where(eq(plannedTransaction.installmentId, installmentId))
  return rows
    .sort((a, b) => (a.planDate ?? '').localeCompare(b.planDate ?? ''))
    .map((row) => row.planId)
}

async function linkedRowInPlan(targetPlanId: string) {
  const [row] = await testDb
    .select()
    .from(plannedTransaction)
    .where(eq(plannedTransaction.planId, targetPlanId))
  return row
}

beforeEach(async () => {
  await seedPlans()
})

describe('PUT /api/transactions/[id]', () => {
  itGuardsIdRoute(PUT, {
    method: 'PUT',
    body: { name: 'X' },
    unknownId: UNKNOWN_ID,
    notFoundName: 'returns 404 when transaction not found',
  })

  it('returns 403 when plan is archived', async () => {
    await seedPlannedTransaction(testDb, {
      id: txId,
      name: 'T',
      type: 'expense',
      dueDate: '2026-02-15',
      amount: 1000,
      planId: archivedPlanId,
    })
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })

  it('rejects invalid body', async () => {
    await seedTx()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { dueDate: '2026/03/01' },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects move to same plan', async () => {
    await seedTx()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { planId },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects move to archived plan', async () => {
    await seedTx()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { planId: archivedPlanId },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })

  it('rejects moving an installment row to another plan', async () => {
    await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
    await seedInstallmentPlan(testDb, {
      id: installmentId,
      startMonth: '2026-03',
      userId,
    })
    await seedPlannedTransaction(testDb, {
      id: txId,
      name: 'Rate',
      type: 'expense',
      dueDate: '2026-03-15',
      amount: 5000,
      planId,
      installmentId,
    })

    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { planId: otherPlanId },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(
      'Raten-Posten können nicht in einen anderen Plan verschoben werden',
    )
  })

  it('returns 409 with the affected counts when budget links exist', async () => {
    await seedBudgetWithLinks()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { planId: otherPlanId },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error:
        'Bestätigung erforderlich: Diesem Budget sind noch Banktransaktionen oder Splits zugeordnet.',
      code: 'BUDGET_LINKS_CONFIRMATION_REQUIRED',
      affectedBankTransactions: 1,
      affectedSplits: 1,
    })
  })

  it('moves the budget once the link removal is confirmed', async () => {
    await seedBudgetWithLinks()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { planId: otherPlanId, confirmClearBudgetLinks: true },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    expect((await res.json()).planId).toBe(otherPlanId)
  })

  it('updates and returns the transaction', async () => {
    await seedTx()
    const res = await putTx({ name: 'Renamed' })
    expect(res.status).toBe(200)
  })

  it('stamps completedAt when the transaction is marked done', async () => {
    await seedTx()
    const res = await putTx({ isDone: true })
    expect(res.status).toBe(200)
    // The body is the row returned by the UPDATE, serialized as an ISO string
    expect(typeof (await res.json()).completedAt).toBe('string')
  })
})

describe('DELETE /api/transactions/[id]', () => {
  itGuardsIdRoute(DELETE, { method: 'DELETE', unknownId: UNKNOWN_ID })

  it('deletes when plan active', async () => {
    await seedTx()
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.installmentSkipped).toBe(false)
  })

  it('shifts the rate into a later plan after the skip', async () => {
    await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
    // 2026-01 … 2026-04 all eligible (the seeded 2026-02 plan is archived)
    await seedPlan(testDb, { id: 'plan-jan', date: '2026-01-01' })
    await seedPlan(testDb, { id: 'plan-feb', date: '2026-02-01' })
    await seedInstallmentPlan(testDb, {
      id: installmentId,
      totalInstallments: 3,
      startMonth: '2026-01',
      userId,
    })
    await syncPlansForInstallment(installmentId)

    const before = await linkedPlanIds()
    expect(before).toEqual(['plan-jan', 'plan-feb', planId])

    const febRow = await linkedRowInPlan('plan-feb')
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: febRow.id },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)

    // February is tombstoned, the rate moves on to the existing April plan
    const skips = await testDb.select().from(installmentSkip)
    expect(skips.map((skip) => skip.month)).toEqual(['2026-02'])
    expect(await linkedPlanIds()).toEqual(['plan-jan', planId, otherPlanId])
  })

  it('records a skip when the row belongs to an installment', async () => {
    await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
    await seedInstallmentPlan(testDb, {
      id: installmentId,
      startMonth: '2026-03',
      userId,
    })
    await seedPlannedTransaction(testDb, {
      id: txId,
      name: 'Rate',
      type: 'expense',
      dueDate: '2026-03-15',
      amount: 5000,
      planId,
      installmentId,
    })

    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.installmentSkipped).toBe(true)

    const skips = await testDb.select().from(installmentSkip)
    expect(skips).toHaveLength(1)
    expect(skips[0].month).toBe('2026-03')
  })
})
