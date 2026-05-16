import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { splitBankTransaction, unsplitBankTransaction, getSplitById } =
  await import('./bank-transaction-splits')
const { getBankTransactionById, getBankTransactions } =
  await import('./bank-transactions')
const splitRoute = await import('@/pages/api/bank-transactions/[id]/split.ts')
const splitPatchRoute =
  await import('@/pages/api/bank-transactions/splits/[splitId].ts')

const now = new Date('2026-03-09T00:00:00.000Z')
const planAId = '11111111-1111-4111-8111-111111111111'
const planBId = '22222222-2222-4222-8222-222222222222'
const budgetAId = '33333333-3333-4333-8333-333333333333'
const budgetBId = '44444444-4444-4444-8444-444444444444'

beforeEach(async () => {
  harness.reset()
  await createSource()
})

afterAll(() => {
  harness.close()
})

async function createSource(id = 'source-1') {
  await testDb.insert(plansSchema.importSource).values({
    id,
    name: 'Testkonto',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
}

async function createPlan(id: string, date: string, isArchived = false) {
  await testDb.insert(plansSchema.plan).values({
    id,
    name: id,
    date,
    isArchived,
    createdAt: now,
    updatedAt: now,
  })
}

async function createBudget(id: string, planId: string) {
  await testDb.insert(plansSchema.plannedTransaction).values({
    id,
    name: id,
    type: 'expense',
    dueDate: `${datePrefix(planId)}-05`,
    amount: 0,
    isDone: false,
    isBudget: true,
    createdAt: now,
    updatedAt: now,
    planId,
  })
}

async function createBankTransactionRow({
  id,
  amountCents,
  description = 'Elterntransaktion',
  counterparty = 'Haendler',
  planId = null,
  budgetId = null,
  preSplitBudgetId = null,
  isSplit = false,
}: {
  id: string
  amountCents: number
  description?: string
  counterparty?: string
  planId?: string | null
  budgetId?: string | null
  preSplitBudgetId?: string | null
  isSplit?: boolean
}) {
  await testDb.insert(plansSchema.bankTransaction).values({
    id,
    sourceId: 'source-1',
    dedupeKey: `dedupe-${id}`,
    bookingDate: '2026-03-01',
    amountCents,
    currency: 'EUR',
    counterparty,
    description,
    status: 'booked',
    rawDataJson: '{}',
    note: null,
    planId,
    planAssignment: planId ? 'manual' : 'none',
    budgetId,
    preSplitBudgetId,
    isArchived: false,
    isSplit,
    importSeenCount: 1,
    createdAt: now,
    updatedAt: now,
  })
}

async function createSplitRow({
  id,
  parentId,
  amountCents,
  label = null,
  planId = null,
  budgetId = null,
}: {
  id: string
  parentId: string
  amountCents: number
  label?: string | null
  planId?: string | null
  budgetId?: string | null
}) {
  await testDb.insert(plansSchema.bankTransactionSplit).values({
    id,
    bankTransactionId: parentId,
    amountCents,
    label,
    planId,
    budgetId,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  })
}

function datePrefix(planId: string) {
  return planId === planBId ? '2026-04' : '2026-03'
}

type ExpectedParentFields = Partial<{
  budgetId: string | null
  preSplitBudgetId: string | null
  isSplit: boolean
}>

async function expectParentState(id: string, expected: ExpectedParentFields) {
  const parent = await getBankTransactionById(id)
  expect(parent).toBeDefined()
  if (!parent) return
  for (const key of Object.keys(expected) as (keyof ExpectedParentFields)[]) {
    const value = expected[key] as string | boolean | null
    expect(parent[key]).toBe(value)
  }
}

async function seedSplitParentAndSplit() {
  await createBankTransactionRow({
    id: 'parent-1',
    amountCents: -10000,
    planId: planAId,
    isSplit: true,
  })
  await createSplitRow({
    id: 'split-1',
    parentId: 'parent-1',
    amountCents: -10000,
    planId: planAId,
  })
}

async function postSplit(id: string, splits: { amountCents: number }[]) {
  return splitRoute.POST({
    params: { id },
    request: new Request(`http://localhost/api/bank-transactions/${id}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ splits }),
    }),
  } as never)
}

async function patchSplit(
  splitId: string,
  body: { planId?: string | null; budgetId?: string | null },
) {
  return splitPatchRoute.PATCH({
    params: { splitId },
    request: new Request(
      `http://localhost/api/bank-transactions/splits/${splitId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    ),
  } as never)
}

describe('bank transaction splits', () => {
  it('accepts a valid split with same-sign non-zero parts', async () => {
    await createPlan(planAId, '2026-03-01')
    await createBankTransactionRow({
      id: 'parent-1',
      amountCents: -10000,
      planId: planAId,
    })

    const response = await postSplit('parent-1', [
      { amountCents: -6000 },
      { amountCents: -4000 },
    ])

    expect(response.status).toBe(200)

    const parent = await getBankTransactionById('parent-1')
    expect(parent?.isSplit).toBe(true)
  })

  it('rejects split payloads with zero-value parts', async () => {
    await createPlan(planAId, '2026-03-01')
    await createBankTransactionRow({
      id: 'parent-1',
      amountCents: -10000,
      planId: planAId,
    })

    const response = await postSplit('parent-1', [
      { amountCents: -5000 },
      { amountCents: 0 },
      { amountCents: -5000 },
    ])

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('Teilbetrag')
  })

  it('rejects split payloads with mixed signs', async () => {
    await createPlan(planAId, '2026-03-01')
    await createBankTransactionRow({
      id: 'parent-1',
      amountCents: -10000,
      planId: planAId,
    })

    const response = await postSplit('parent-1', [
      { amountCents: -7000 },
      { amountCents: 2000 },
      { amountCents: -5000 },
    ])

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('Vorzeichen')
  })

  it('rejects split payloads whose sum differs from the parent amount', async () => {
    await createPlan(planAId, '2026-03-01')
    await createBankTransactionRow({
      id: 'parent-1',
      amountCents: -10000,
      planId: planAId,
    })

    const response = await postSplit('parent-1', [
      { amountCents: -5000 },
      { amountCents: -4000 },
    ])

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('Summe der Teile')
  })

  it('restores the original parent budget when undoing a split', async () => {
    await createPlan(planAId, '2026-03-01')
    await createBudget(budgetAId, planAId)
    await createBankTransactionRow({
      id: 'parent-1',
      amountCents: -10000,
      planId: planAId,
      budgetId: budgetAId,
    })

    await splitBankTransaction('parent-1', [
      { amountCents: -7000, label: 'Wohnen' },
      { amountCents: -3000, label: 'Freizeit' },
    ])

    await expectParentState('parent-1', {
      budgetId: null,
      preSplitBudgetId: budgetAId,
    })

    await unsplitBankTransaction('parent-1')

    await expectParentState('parent-1', {
      isSplit: false,
      budgetId: budgetAId,
      preSplitBudgetId: null,
    })
  })

  it('keeps parent budget empty after undo when no pre-split budget existed', async () => {
    await createPlan(planAId, '2026-03-01')
    await createBankTransactionRow({
      id: 'parent-1',
      amountCents: -10000,
      planId: planAId,
    })

    await splitBankTransaction('parent-1', [
      { amountCents: -8000 },
      { amountCents: -2000 },
    ])
    await unsplitBankTransaction('parent-1')

    const parent = await getBankTransactionById('parent-1')
    expect(parent?.budgetId).toBeNull()
    expect(parent?.preSplitBudgetId).toBeNull()
  })

  it('rejects assigning a split budget from a different plan', async () => {
    await createPlan(planAId, '2026-03-01')
    await createPlan(planBId, '2026-04-01')
    await createBudget(budgetAId, planAId)
    await createBudget(budgetBId, planBId)
    await seedSplitParentAndSplit()

    const response = await patchSplit('split-1', { budgetId: budgetBId })

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('Budget gehört nicht')
  })

  it('allows assigning a split budget together with a matching new plan', async () => {
    await createPlan(planAId, '2026-03-01')
    await createPlan(planBId, '2026-04-01')
    await createBudget(budgetBId, planBId)
    await seedSplitParentAndSplit()

    const response = await patchSplit('split-1', {
      planId: planBId,
      budgetId: budgetBId,
    })

    expect(response.status).toBe(200)

    const split = await getSplitById('split-1')
    expect(split?.planId).toBe(planBId)
    expect(split?.budgetId).toBe(budgetBId)
  })

  it('rejects assigning a split budget when no effective plan exists', async () => {
    await createPlan(planAId, '2026-03-01')
    await createBudget(budgetAId, planAId)
    await createBankTransactionRow({
      id: 'parent-1',
      amountCents: -10000,
      isSplit: true,
    })
    await createSplitRow({
      id: 'split-1',
      parentId: 'parent-1',
      amountCents: -10000,
    })

    const response = await patchSplit('split-1', { budgetId: budgetAId })

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('Budget gehört nicht')
  })

  it('finds split rows when searching by split label', async () => {
    await createPlan(planAId, '2026-03-01')
    await createBankTransactionRow({
      id: 'parent-1',
      amountCents: -10000,
      description: 'Stromrechnung',
      counterparty: 'Energie AG',
      planId: planAId,
      isSplit: true,
    })
    await createSplitRow({
      id: 'split-1',
      parentId: 'parent-1',
      amountCents: -10000,
      label: 'Kaffee mit Freunden',
      planId: planAId,
    })

    const result = await getBankTransactions({ search: 'Kaffee' })

    expect(result.pagination.total).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.rowType).toBe('split')
    expect(result.rows[0]?.label).toBe('Kaffee mit Freunden')
  })
})
