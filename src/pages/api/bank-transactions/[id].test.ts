import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itGuardsIdRoute } from '@/lib/__fixtures__/route-guards'
import {
  seedBankTransaction,
  seedImportSource,
  seedPlan,
  seedPlannedTransaction,
} from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { PATCH, DELETE } = await import('./[id]')

const planId = '11111111-1111-4111-8111-111111111111'
const archivedPlanId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'
const btId = '44444444-4444-4444-8444-444444444444'
const budgetId = '55555555-5555-4555-8555-555555555555'

async function seedBase() {
  await seedImportSource(testDb, { id: sourceId })
  await seedPlan(testDb, {
    id: planId,
    date: '2026-03-01',
    isArchived: false,
  })
  await seedPlan(testDb, {
    id: archivedPlanId,
    date: '2026-02-01',
    isArchived: true,
  })
}

async function seedBankTx() {
  await seedBankTransaction(testDb, {
    id: btId,
    sourceId,
    amountCents: -1000,
  })
}

async function seedBudget() {
  await seedPlannedTransaction(testDb, {
    id: budgetId,
    name: 'Budget',
    type: 'expense',
    dueDate: '2026-03-05',
    amount: 0,
    isBudget: true,
    planId,
  })
}

beforeEach(async () => {
  await seedBase()
})

describe('PATCH /api/bank-transactions/[id]', () => {
  itGuardsIdRoute(PATCH, {
    method: 'PATCH',
    body: { note: 'x' },
    unknownId: btId,
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
    await seedPlan(testDb, {
      id: otherPlanId,
      date: '2026-04-01',
      isArchived: false,
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
  itGuardsIdRoute(DELETE, { method: 'DELETE', unknownId: btId })

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
