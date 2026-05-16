import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const {
  buildSpendingRecord,
  bulkArchiveSplits,
  bulkAssignBudgetToSplits,
  bulkAssignPlanToSplits,
  getBudgetSpendingFromSplits,
  getBudgetSpendingFromSplitsForPlan,
  getSplitById,
  splitBankTransaction,
  updateSplitFields,
} = await import('./bank-transaction-splits')

const now = new Date('2026-03-09T00:00:00.000Z')
const planAId = 'plan-a'
const planBId = 'plan-b'

async function seedSource() {
  await testDb.insert(plansSchema.importSource).values({
    id: 'src-1',
    name: 'Source',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
}

async function seedPlan(id: string) {
  await testDb.insert(plansSchema.plan).values({
    id,
    name: id,
    date: id === planBId ? '2026-04-01' : '2026-03-01',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  })
}

async function seedBudget(id: string, planId: string) {
  await testDb.insert(plansSchema.plannedTransaction).values({
    id,
    name: id,
    type: 'expense',
    dueDate: '2026-03-05',
    amount: 0,
    isBudget: true,
    planId,
    createdAt: now,
    updatedAt: now,
  })
}

async function seedBankTx(
  id: string,
  overrides: Partial<typeof plansSchema.bankTransaction.$inferInsert> = {},
) {
  await testDb.insert(plansSchema.bankTransaction).values({
    id,
    sourceId: 'src-1',
    dedupeKey: `dk-${id}`,
    bookingDate: '2026-03-10',
    amountCents: -3000,
    currency: 'EUR',
    status: 'booked',
    rawDataJson: '{}',
    isArchived: false,
    isSplit: false,
    importSeenCount: 1,
    planAssignment: 'none',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
}

async function seedSplit(
  id: string,
  parentId: string,
  overrides: Partial<typeof plansSchema.bankTransactionSplit.$inferInsert> = {},
) {
  await testDb.insert(plansSchema.bankTransactionSplit).values({
    id,
    bankTransactionId: parentId,
    amountCents: -1500,
    sortOrder: 0,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
}

beforeEach(async () => {
  harness.reset()
  await seedSource()
  await seedPlan(planAId)
  await seedPlan(planBId)
})

afterAll(() => {
  harness.close()
})

describe('splitBankTransaction validation errors', () => {
  it('rejects zero-amount parents', async () => {
    await seedBankTx('bt-1', { amountCents: 0 })
    expect(
      splitBankTransaction('bt-1', [
        { amountCents: -100 },
        { amountCents: 100 },
      ]),
    ).rejects.toThrow('0,00')
  })

  it('rejects split-sign mismatch', async () => {
    await seedBankTx('bt-1', { amountCents: -1000 })
    expect(
      splitBankTransaction('bt-1', [
        { amountCents: -500 },
        { amountCents: 500 }, // wrong sign
      ]),
    ).rejects.toThrow('Vorzeichen')
  })

  it('rejects non-integer or zero-cent splits', async () => {
    await seedBankTx('bt-1', { amountCents: -1000 })
    expect(
      splitBankTransaction('bt-1', [
        { amountCents: -1000 },
        { amountCents: 0 },
      ]),
    ).rejects.toThrow('Cent-Betrag')
  })

  it('rejects when split sum does not equal parent', async () => {
    await seedBankTx('bt-1', { amountCents: -1000 })
    expect(
      splitBankTransaction('bt-1', [
        { amountCents: -500 },
        { amountCents: -300 },
      ]),
    ).rejects.toThrow('Originalbetrag')
  })

  it('rejects single-split input', async () => {
    await seedBankTx('bt-1', { amountCents: -1000 })
    expect(
      splitBankTransaction('bt-1', [{ amountCents: -1000 }]),
    ).rejects.toThrow('Mindestens zwei')
  })

  it('rejects already-split transactions', async () => {
    await seedBankTx('bt-1', { amountCents: -1000, isSplit: true })
    expect(
      splitBankTransaction('bt-1', [
        { amountCents: -500 },
        { amountCents: -500 },
      ]),
    ).rejects.toThrow('bereits aufgeteilt')
  })

  it('rejects missing transactions', async () => {
    expect(
      splitBankTransaction('missing', [
        { amountCents: -500 },
        { amountCents: -500 },
      ]),
    ).rejects.toThrow('nicht gefunden')
  })
})

describe('getSplitById', () => {
  it('returns the split when found', async () => {
    await seedBankTx('bt-1', { isSplit: true })
    await seedSplit('split-1', 'bt-1')
    expect((await getSplitById('split-1'))?.id).toBe('split-1')
  })

  it('returns undefined for missing id', async () => {
    expect(await getSplitById('missing')).toBeUndefined()
  })
})

describe('buildSpendingRecord', () => {
  it('aggregates absolute amounts, skipping null budget ids', () => {
    const record = buildSpendingRecord([
      { budgetId: 'b-1', spent: -1500 },
      { budgetId: 'b-2', spent: '500' },
      { budgetId: null, spent: -200 },
    ])
    expect(record).toEqual({ 'b-1': 1500, 'b-2': 500 })
  })

  it('returns empty record for empty input', () => {
    expect(buildSpendingRecord([])).toEqual({})
  })
})

describe('getBudgetSpendingFromSplits', () => {
  it('returns empty record for empty input', async () => {
    expect(await getBudgetSpendingFromSplits([])).toEqual({})
  })

  it('aggregates split spending by budgetId', async () => {
    await seedBudget('b-1', planAId)
    await seedBankTx('bt-1', { isSplit: true })
    await seedSplit('split-1', 'bt-1', {
      budgetId: 'b-1',
      amountCents: -300,
    })
    await seedSplit('split-2', 'bt-1', {
      budgetId: 'b-1',
      amountCents: -700,
    })
    expect(await getBudgetSpendingFromSplits(['b-1'])).toEqual({ 'b-1': 1000 })
  })
})

describe('getBudgetSpendingFromSplitsForPlan', () => {
  it('aggregates split amounts for budgets within a plan', async () => {
    await seedBudget('b-1', planAId)
    await seedBudget('b-2', planBId)
    await seedBankTx('bt-1', { isSplit: true })
    await seedSplit('split-1', 'bt-1', {
      planId: planAId,
      budgetId: 'b-1',
      amountCents: -500,
    })
    await seedSplit('split-2', 'bt-1', {
      planId: planBId,
      budgetId: 'b-2',
      amountCents: -800,
    })
    const a = await getBudgetSpendingFromSplitsForPlan(planAId)
    const b = await getBudgetSpendingFromSplitsForPlan(planBId)
    expect(a).toEqual({ 'b-1': 500 })
    expect(b).toEqual({ 'b-2': 800 })
  })
})

describe('updateSplitFields', () => {
  it('clears budget when plan changes', async () => {
    await seedBudget('b-1', planAId)
    await seedBankTx('bt-1', { isSplit: true })
    await seedSplit('split-1', 'bt-1', { planId: planAId, budgetId: 'b-1' })
    const updated = await updateSplitFields('split-1', { planId: planBId })
    expect(updated?.planId).toBe(planBId)
    expect(updated?.budgetId).toBeNull()
  })

  it('updates note only when only note provided', async () => {
    await seedBankTx('bt-1', { isSplit: true })
    await seedSplit('split-1', 'bt-1', { planId: planAId })
    const updated = await updateSplitFields('split-1', { note: 'memo' })
    expect(updated?.note).toBe('memo')
    expect(updated?.planId).toBe(planAId)
  })

  it('returns undefined when nothing matches', async () => {
    expect(await updateSplitFields('missing', { note: 'x' })).toBeUndefined()
  })
})

describe('bulkAssignPlanToSplits', () => {
  it('returns 0 for empty input', async () => {
    expect(await bulkAssignPlanToSplits([], planAId)).toBe(0)
  })

  it('partitions by current plan: same plan keeps budget, different plan clears', async () => {
    await seedBudget('b-1', planAId)
    await seedBankTx('bt-1', { isSplit: true })
    await seedSplit('split-same', 'bt-1', {
      planId: planAId,
      budgetId: 'b-1',
    })
    await seedSplit('split-diff', 'bt-1', {
      planId: planBId,
      budgetId: 'b-1',
    })

    await bulkAssignPlanToSplits(['split-same', 'split-diff'], planAId)

    const same = await getSplitById('split-same')
    const diff = await getSplitById('split-diff')
    expect(same?.budgetId).toBe('b-1')
    expect(diff?.budgetId).toBeNull()
    expect(diff?.planId).toBe(planAId)
  })

  it('returns 0 when no rows match the ids', async () => {
    expect(await bulkAssignPlanToSplits(['missing'], planAId)).toBe(0)
  })
})

describe('bulkArchiveSplits', () => {
  it('returns 0 for empty input', async () => {
    expect(await bulkArchiveSplits([], true)).toBe(0)
  })

  it('toggles isArchived', async () => {
    await seedBankTx('bt-1', { isSplit: true })
    await seedSplit('split-1', 'bt-1')
    expect(await bulkArchiveSplits(['split-1'], true)).toBe(1)
    expect((await getSplitById('split-1'))?.isArchived).toBe(true)
  })
})

describe('bulkAssignBudgetToSplits', () => {
  it('returns 0 for empty input', async () => {
    expect(await bulkAssignBudgetToSplits([], 'b-1')).toBe(0)
  })

  it('sets a new budgetId', async () => {
    await seedBudget('b-1', planAId)
    await seedBankTx('bt-1', { isSplit: true })
    await seedSplit('split-1', 'bt-1', { planId: planAId })
    await bulkAssignBudgetToSplits(['split-1'], 'b-1')
    expect((await getSplitById('split-1'))?.budgetId).toBe('b-1')
  })

  it('clears budgetId when given null', async () => {
    await seedBankTx('bt-1', { isSplit: true })
    await seedSplit('split-1', 'bt-1', { budgetId: null })
    await bulkAssignBudgetToSplits(['split-1'], null)
    expect((await getSplitById('split-1'))?.budgetId).toBeNull()
  })
})
