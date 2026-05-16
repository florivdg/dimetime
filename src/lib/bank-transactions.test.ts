import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const {
  bulkArchiveBankTransactions,
  bulkAssignBudgetToTransactions,
  bulkAssignPlanToTransactions,
  createImportSource,
  deleteBankTransaction,
  deleteImportSource,
  getBankTransactionById,
  getBankTransactions,
  getImportSourceById,
  getImportSources,
  updateBankTransactionFields,
  updateImportSource,
  validateBankTransactionPatch,
} = await import('./bank-transactions')

const now = new Date('2026-03-09T00:00:00.000Z')
const sourceId = 'src-1'
const planId = 'plan-1'

async function seedSource(id = sourceId, isActive = true) {
  await testDb.insert(plansSchema.importSource).values({
    id,
    name: id,
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive,
    createdAt: now,
    updatedAt: now,
  })
}

async function seedPlan(id = planId, isArchived = false) {
  await testDb.insert(plansSchema.plan).values({
    id,
    name: id,
    date: '2026-03-01',
    isArchived,
    createdAt: now,
    updatedAt: now,
  })
}

async function seedBudget(id: string, plan = planId) {
  await testDb.insert(plansSchema.plannedTransaction).values({
    id,
    name: id,
    type: 'expense',
    dueDate: '2026-03-05',
    amount: 0,
    isBudget: true,
    planId: plan,
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
    sourceId,
    dedupeKey: `dk-${id}`,
    bookingDate: '2026-03-10',
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
    amountCents: -500,
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
  await seedPlan()
})

afterAll(() => {
  harness.close()
})

describe('import sources CRUD', () => {
  it('createImportSource fills defaults', async () => {
    const created = await createImportSource({
      name: 'New',
      preset: 'ing_csv_v1',
      sourceKind: 'credit_card',
    })
    expect(created.defaultPlanAssignment).toBe('auto_month')
    expect(created.isActive).toBe(true)
  })

  it('getImportSources returns all sources ordered by createdAt desc', async () => {
    await seedSource('src-2')
    const sources = await getImportSources()
    expect(sources.map((s) => s.id).sort()).toEqual(['src-1', 'src-2'])
  })

  it('getImportSourceById returns matching source', async () => {
    expect((await getImportSourceById(sourceId))?.id).toBe(sourceId)
    expect(await getImportSourceById('missing')).toBeUndefined()
  })

  it('updateImportSource updates only provided fields', async () => {
    const updated = await updateImportSource(sourceId, { name: 'Renamed' })
    expect(updated?.name).toBe('Renamed')
  })

  it('deleteImportSource succeeds when no bank transactions reference it', async () => {
    const result = await deleteImportSource(sourceId)
    expect(result.deleted).toBe(true)
    expect(await getImportSourceById(sourceId)).toBeUndefined()
  })

  it('deleteImportSource blocks when bank transactions exist', async () => {
    await seedBankTx('bt-1')
    const result = await deleteImportSource(sourceId)
    expect(result.deleted).toBe(false)
    expect(result.error).toContain('1 verknüpfte')
  })
})

describe('getBankTransactions', () => {
  beforeEach(async () => {
    await seedBudget('budget-a')
    await seedBankTx('bt-1', {
      planId,
      budgetId: 'budget-a',
      planAssignment: 'manual',
      counterparty: 'Amazon',
      description: 'Order 123',
      bookingDate: '2026-03-05',
      amountCents: -2000,
      status: 'booked',
    })
    await seedBankTx('bt-2', {
      counterparty: 'Spotify',
      description: 'Subscription',
      bookingDate: '2026-03-08',
      amountCents: -1500,
      status: 'pending',
    })
    await seedBankTx('bt-archived', {
      isArchived: true,
      bookingDate: '2026-03-01',
    })
    await seedBankTx('bt-split-parent', {
      isSplit: true,
      bookingDate: '2026-03-04',
      amountCents: -3000,
    })
    await seedSplit('split-1', 'bt-split-parent', {
      planId,
      label: 'Special label',
      amountCents: -1500,
    })
    await seedSplit('split-2', 'bt-split-parent', { amountCents: -1500 })
  })

  it('hides archived rows by default', async () => {
    const { rows } = await getBankTransactions()
    expect(rows.map((r) => r.id)).not.toContain('bt-archived')
  })

  it('shows archived when showArchived=true', async () => {
    const { rows } = await getBankTransactions({ showArchived: true })
    expect(rows.map((r) => r.id)).toContain('bt-archived')
  })

  it('filters by sourceId', async () => {
    const { rows } = await getBankTransactions({ sourceId })
    expect(rows.length).toBeGreaterThan(0)
  })

  it('filters by status', async () => {
    const { rows } = await getBankTransactions({ status: 'pending' })
    expect(rows.map((r) => r.id)).toEqual(['bt-2'])
  })

  it('filters by date range', async () => {
    const { rows } = await getBankTransactions({
      dateFrom: '2026-03-05',
      dateTo: '2026-03-05',
    })
    expect(rows.map((r) => r.id)).toContain('bt-1')
  })

  it('searches across description/counterparty for transactions', async () => {
    const { rows } = await getBankTransactions({ search: 'Spotify' })
    expect(rows.map((r) => r.id)).toEqual(['bt-2'])
  })

  it('search across split label includes split rows', async () => {
    const { rows } = await getBankTransactions({ search: 'Special' })
    expect(rows.map((r) => r.id)).toContain('split-1')
  })

  it('filters by planId across transactions and splits', async () => {
    const { rows } = await getBankTransactions({ planId })
    const ids = rows.map((r) => r.id).sort()
    expect(ids).toContain('bt-1')
    expect(ids).toContain('split-1')
    expect(ids).not.toContain('split-2')
  })

  it('paginates results', async () => {
    const { rows, pagination } = await getBankTransactions({
      limit: 2,
      page: 1,
    })
    expect(rows).toHaveLength(2)
    expect(pagination.total).toBeGreaterThanOrEqual(2)
  })

  it('returns all rows when limit=-1', async () => {
    const { rows, pagination } = await getBankTransactions({
      limit: -1,
      showArchived: true,
    })
    expect(pagination.totalPages).toBe(1)
    expect(rows.length).toBeGreaterThan(3)
  })

  it('sorts by amountCents asc', async () => {
    const { rows } = await getBankTransactions({
      sortBy: 'amountCents',
      sortDir: 'asc',
    })
    const amounts = rows.map((r) => r.amountCents)
    const sorted = [...amounts].sort((a, b) => a - b)
    expect(amounts).toEqual(sorted)
  })

  it('sorts by createdAt', async () => {
    const { rows } = await getBankTransactions({ sortBy: 'createdAt' })
    expect(rows.length).toBeGreaterThan(0)
  })
})

describe('getBankTransactionById', () => {
  it('returns existing tx', async () => {
    await seedBankTx('bt-1')
    expect((await getBankTransactionById('bt-1'))?.id).toBe('bt-1')
  })

  it('returns undefined for missing id', async () => {
    expect(await getBankTransactionById('missing')).toBeUndefined()
  })
})

describe('deleteBankTransaction', () => {
  it('deletes and returns true', async () => {
    await seedBankTx('bt-1')
    expect(await deleteBankTransaction('bt-1')).toBe(true)
  })

  it('returns false for missing id', async () => {
    expect(await deleteBankTransaction('missing')).toBe(false)
  })
})

describe('validateBankTransactionPatch', () => {
  const existing = { planId: null }

  it('returns null when no relevant fields are touched', async () => {
    const result = await validateBankTransactionPatch(
      { note: 'memo' },
      existing,
      async () => ({ isArchived: false }),
      async () => ({ isBudget: true, planId: null }),
    )
    expect(result).toBeNull()
  })

  it('returns 404 when target plan does not exist', async () => {
    const result = await validateBankTransactionPatch(
      { planId: 'missing' },
      existing,
      async () => null,
      async () => ({ isBudget: true, planId: null }),
    )
    expect(result?.status).toBe(404)
  })

  it('returns 400 when target plan is archived', async () => {
    const result = await validateBankTransactionPatch(
      { planId: 'p2' },
      existing,
      async () => ({ isArchived: true }),
      async () => ({ isBudget: true, planId: null }),
    )
    expect(result?.status).toBe(400)
  })

  it('returns 404 when budget does not exist', async () => {
    const result = await validateBankTransactionPatch(
      { budgetId: 'missing' },
      existing,
      async () => ({ isArchived: false }),
      async () => null,
    )
    expect(result?.status).toBe(404)
  })

  it('returns 400 when budget is not actually a budget', async () => {
    const result = await validateBankTransactionPatch(
      { budgetId: 'b1' },
      existing,
      async () => ({ isArchived: false }),
      async () => ({ isBudget: false, planId: planId }),
    )
    expect(result?.status).toBe(400)
  })

  it('returns 400 when budget belongs to a different plan than the effective plan', async () => {
    const result = await validateBankTransactionPatch(
      { budgetId: 'b1' },
      { planId: 'plan-A' },
      async () => ({ isArchived: false }),
      async () => ({ isBudget: true, planId: 'plan-B' }),
    )
    expect(result?.status).toBe(400)
  })

  it('uses the new planId when both are specified', async () => {
    const result = await validateBankTransactionPatch(
      { planId: 'plan-B', budgetId: 'b1' },
      { planId: 'plan-A' },
      async () => ({ isArchived: false }),
      async () => ({ isBudget: true, planId: 'plan-B' }),
    )
    expect(result).toBeNull()
  })

  it('allows clearing planId (null)', async () => {
    const result = await validateBankTransactionPatch(
      { planId: null },
      { planId: 'plan-A' },
      async () => ({ isArchived: false }),
      async () => ({ isBudget: true, planId: null }),
    )
    expect(result).toBeNull()
  })
})

describe('updateBankTransactionFields', () => {
  it('clears budgetId and sets planAssignment=manual when planId set', async () => {
    await seedBudget('b-1')
    await seedBankTx('bt-1', {
      planId,
      budgetId: 'b-1',
      planAssignment: 'manual',
    })
    await seedPlan('plan-2')
    await updateBankTransactionFields('bt-1', { planId: 'plan-2' })
    const tx = await getBankTransactionById('bt-1')
    expect(tx?.planId).toBe('plan-2')
    expect(tx?.planAssignment).toBe('manual')
    expect(tx?.budgetId).toBeNull()
  })

  it('sets planAssignment=none when planId cleared', async () => {
    await seedBankTx('bt-1', { planId, planAssignment: 'manual' })
    await updateBankTransactionFields('bt-1', { planId: null })
    const tx = await getBankTransactionById('bt-1')
    expect(tx?.planId).toBeNull()
    expect(tx?.planAssignment).toBe('none')
  })

  it('updates note only when only note provided', async () => {
    await seedBankTx('bt-1', {
      planId,
      budgetId: null,
      planAssignment: 'manual',
    })
    await updateBankTransactionFields('bt-1', { note: 'memo' })
    const tx = await getBankTransactionById('bt-1')
    expect(tx?.note).toBe('memo')
    expect(tx?.planId).toBe(planId)
    expect(tx?.planAssignment).toBe('manual')
  })
})

describe('bulk operations on bank transactions', () => {
  it('bulkArchiveBankTransactions toggles isArchived', async () => {
    await seedBankTx('bt-1')
    await seedBankTx('bt-2')
    const count = await bulkArchiveBankTransactions(['bt-1', 'bt-2'], true)
    expect(count).toBe(2)
    const tx = await getBankTransactionById('bt-1')
    expect(tx?.isArchived).toBe(true)
  })

  it('bulkAssignBudgetToTransactions sets new budgetId', async () => {
    await seedBudget('b-1')
    await seedBankTx('bt-1', { planId, planAssignment: 'manual' })
    await seedBankTx('bt-2', { planId, planAssignment: 'manual' })
    const count = await bulkAssignBudgetToTransactions(['bt-1', 'bt-2'], 'b-1')
    expect(count).toBe(2)
    const tx = await getBankTransactionById('bt-1')
    expect(tx?.budgetId).toBe('b-1')
  })

  it('bulkAssignPlanToTransactions clears budget when plan differs, keeps when matches', async () => {
    await seedBudget('b-1')
    await seedPlan('plan-2')
    await seedBudget('b-2', 'plan-2')
    await seedBankTx('bt-same', {
      planId,
      budgetId: 'b-1',
      planAssignment: 'manual',
    })
    await seedBankTx('bt-diff', {
      planId,
      budgetId: 'b-1',
      planAssignment: 'manual',
    })

    // First, assign all to plan-1 (same plan as their current planId)
    const count = await bulkAssignPlanToTransactions(
      ['bt-same', 'bt-diff'],
      planId,
    )
    expect(count).toBe(2)

    const same = await getBankTransactionById('bt-same')
    expect(same?.budgetId).toBe('b-1')

    // Now move bt-diff to plan-2 — budget should be cleared
    await bulkAssignPlanToTransactions(['bt-diff'], 'plan-2')
    const diff = await getBankTransactionById('bt-diff')
    expect(diff?.planId).toBe('plan-2')
    expect(diff?.budgetId).toBeNull()
    expect(diff?.planAssignment).toBe('manual')
  })

  it('bulkAssignPlanToTransactions sets planAssignment=none when planId is null', async () => {
    await seedBankTx('bt-1', { planId, planAssignment: 'manual' })
    await bulkAssignPlanToTransactions(['bt-1'], null)
    const tx = await getBankTransactionById('bt-1')
    expect(tx?.planId).toBeNull()
    expect(tx?.planAssignment).toBe('none')
  })

  it('bulkAssignPlanToTransactions returns 0 when no matching rows', async () => {
    expect(await bulkAssignPlanToTransactions(['missing'], planId)).toBe(0)
  })
})
