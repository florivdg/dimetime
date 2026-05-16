import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const {
  adjustDueDateToMonth,
  createTransaction,
  deleteTransaction,
  getBudgetSpendingForBudgets,
  getBudgetSpendingForPlan,
  getBudgetsForPlan,
  getPlanBalance,
  getTransactionById,
  getTransactions,
  parseTransactionQueryParams,
  requireUnarchivedTransaction,
  updateTransaction,
  validateTransactionPlanChange,
} = await import('./transactions')

const now = new Date('2026-03-09T00:00:00.000Z')
const planId = 'plan-1'
const archivedPlanId = 'plan-archived'

async function insertPlan(id: string, isArchived = false) {
  await testDb.insert(plansSchema.plan).values({
    id,
    name: id,
    date: '2026-03-01',
    isArchived,
    createdAt: now,
    updatedAt: now,
  })
}

async function insertCategory(
  id: string,
  name = id,
  color: string | null = null,
) {
  await testDb.insert(plansSchema.category).values({
    id,
    name,
    slug: id,
    color,
    createdAt: now,
    updatedAt: now,
  })
}

async function insertSource(id = 'src-1') {
  await testDb.insert(plansSchema.importSource).values({
    id,
    name: id,
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
}

async function insertTx(
  id: string,
  overrides: Partial<typeof plansSchema.plannedTransaction.$inferInsert> = {},
) {
  await testDb.insert(plansSchema.plannedTransaction).values({
    id,
    name: id,
    type: 'expense',
    dueDate: '2026-03-15',
    amount: 1000,
    isDone: false,
    isBudget: false,
    planId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
}

beforeEach(async () => {
  harness.reset()
  await insertPlan(planId)
  await insertPlan(archivedPlanId, true)
})

afterAll(() => {
  harness.close()
})

describe('parseTransactionQueryParams', () => {
  it('extracts the documented keys from URLSearchParams', () => {
    const params = parseTransactionQueryParams(
      new URLSearchParams('search=x&page=2&unknown=skip'),
    )
    expect(params.search).toBe('x')
    expect(params.page).toBe('2')
    expect((params as Record<string, unknown>).unknown).toBeUndefined()
  })
})

describe('adjustDueDateToMonth', () => {
  it('preserves day when valid in target month', () => {
    expect(adjustDueDateToMonth('2024-01-15', '2024-03-01')).toBe('2024-03-15')
  })

  it('clamps to 28 for February in non-leap year', () => {
    expect(adjustDueDateToMonth('2024-01-31', '2023-02-01')).toBe('2023-02-28')
  })

  it('clamps to 29 for February in leap year', () => {
    expect(adjustDueDateToMonth('2024-01-31', '2024-02-01')).toBe('2024-02-29')
  })

  it('clamps to 30 for 30-day months', () => {
    expect(adjustDueDateToMonth('2024-01-31', '2024-04-01')).toBe('2024-04-30')
  })

  it('handles year boundary', () => {
    expect(adjustDueDateToMonth('2024-12-25', '2025-01-01')).toBe('2025-01-25')
  })
})

describe('createTransaction', () => {
  it('persists provided fields with defaults', async () => {
    const tx = await createTransaction({
      name: 'Test',
      planId,
      dueDate: '2026-03-10',
      amount: 5000,
    })
    expect(tx.name).toBe('Test')
    expect(tx.type).toBe('expense')
    expect(tx.isDone).toBe(false)
    expect(tx.isBudget).toBe(false)
    expect(tx.note).toBeNull()
    expect(tx.categoryId).toBeNull()
  })

  it('honors explicit type, isDone, isBudget, categoryId, note', async () => {
    await insertCategory('cat-1')
    const tx = await createTransaction({
      name: 'Income',
      type: 'income',
      isDone: true,
      isBudget: true,
      planId,
      dueDate: '2026-03-12',
      amount: 7000,
      categoryId: 'cat-1',
      note: 'memo',
    })
    expect(tx.type).toBe('income')
    expect(tx.isDone).toBe(true)
    expect(tx.isBudget).toBe(true)
    expect(tx.categoryId).toBe('cat-1')
    expect(tx.note).toBe('memo')
  })
})

describe('getTransactionById', () => {
  it('returns the transaction when found', async () => {
    await insertTx('tx-1')
    expect((await getTransactionById('tx-1'))?.id).toBe('tx-1')
  })

  it('returns undefined when not found', async () => {
    expect(await getTransactionById('missing')).toBeUndefined()
  })
})

describe('requireUnarchivedTransaction', () => {
  it('returns 400 when id is missing', async () => {
    const result = await requireUnarchivedTransaction(undefined, 'bearbeitet')
    expect((result as Response).status).toBe(400)
  })

  it('returns 404 when not found', async () => {
    const result = await requireUnarchivedTransaction('missing', 'gelöscht')
    expect((result as Response).status).toBe(404)
  })

  it('returns 403 when the plan is archived', async () => {
    await insertTx('tx-archived', { planId: archivedPlanId })
    const result = await requireUnarchivedTransaction(
      'tx-archived',
      'bearbeitet',
    )
    expect((result as Response).status).toBe(403)
  })

  it('returns the transaction when plan is active', async () => {
    await insertTx('tx-ok')
    const result = await requireUnarchivedTransaction('tx-ok', 'bearbeitet')
    expect(result).not.toBeInstanceOf(Response)
    expect((result as { id: string }).id).toBe('tx-ok')
  })
})

describe('validateTransactionPlanChange', () => {
  it('returns null when no nextPlanId requested', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      undefined,
      async () => ({ isArchived: false }),
    )
    expect(result).toBeNull()
  })

  it('rejects when nextPlanId equals currentPlanId', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      planId,
      async () => ({
        isArchived: false,
      }),
    )
    expect(result?.status).toBe(400)
  })

  it('returns 404 when target plan does not exist', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      'missing',
      async () => undefined,
    )
    expect(result?.status).toBe(404)
  })

  it('returns 403 when target plan is archived', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      'p-other',
      async () => ({ isArchived: true }),
    )
    expect(result?.status).toBe(403)
  })

  it('returns null on a valid plan move', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      'p-other',
      async () => ({ isArchived: false }),
    )
    expect(result).toBeNull()
  })
})

describe('updateTransaction', () => {
  it('returns undefined for missing id', async () => {
    expect(await updateTransaction('missing', { name: 'x' })).toBeUndefined()
  })

  it('only updates provided fields', async () => {
    await insertTx('tx-1', { name: 'Old', note: 'keep' })
    const updated = await updateTransaction('tx-1', { name: 'New' })
    expect(updated?.name).toBe('New')
    expect(updated?.note).toBe('keep')
  })

  it('clears bank-transaction.budgetId when plan is changed', async () => {
    await insertPlan('plan-2')
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await testDb.insert(plansSchema.bankTransaction).values({
      id: 'bt-1',
      sourceId: 'src-1',
      dedupeKey: 'k-1',
      bookingDate: '2026-03-15',
      amountCents: -1000,
      currency: 'EUR',
      rawDataJson: '{}',
      status: 'booked',
      planId,
      planAssignment: 'manual',
      budgetId: 'budget-tx',
      isArchived: false,
      isSplit: false,
      importSeenCount: 1,
      createdAt: now,
      updatedAt: now,
    })

    await updateTransaction('budget-tx', { planId: 'plan-2' })
    const bt = await testDb.query.bankTransaction.findFirst({
      where: (t, { eq: e }) => e(t.id, 'bt-1'),
    })
    expect(bt?.budgetId).toBeNull()
  })

  it('clears bank-transaction.budgetId when isBudget set to false', async () => {
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await testDb.insert(plansSchema.bankTransaction).values({
      id: 'bt-1',
      sourceId: 'src-1',
      dedupeKey: 'k-1',
      bookingDate: '2026-03-15',
      amountCents: -1000,
      currency: 'EUR',
      rawDataJson: '{}',
      status: 'booked',
      planId,
      planAssignment: 'manual',
      budgetId: 'budget-tx',
      isArchived: false,
      isSplit: false,
      importSeenCount: 1,
      createdAt: now,
      updatedAt: now,
    })

    await updateTransaction('budget-tx', { isBudget: false })
    const bt = await testDb.query.bankTransaction.findFirst({
      where: (t, { eq: e }) => e(t.id, 'bt-1'),
    })
    expect(bt?.budgetId).toBeNull()
  })

  it('does not clear budgetId when plan and isBudget unchanged', async () => {
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await testDb.insert(plansSchema.bankTransaction).values({
      id: 'bt-1',
      sourceId: 'src-1',
      dedupeKey: 'k-1',
      bookingDate: '2026-03-15',
      amountCents: -1000,
      currency: 'EUR',
      rawDataJson: '{}',
      status: 'booked',
      planId,
      planAssignment: 'manual',
      budgetId: 'budget-tx',
      isArchived: false,
      isSplit: false,
      importSeenCount: 1,
      createdAt: now,
      updatedAt: now,
    })

    await updateTransaction('budget-tx', { name: 'Renamed' })
    const bt = await testDb.query.bankTransaction.findFirst({
      where: (t, { eq: e }) => e(t.id, 'bt-1'),
    })
    expect(bt?.budgetId).toBe('budget-tx')
  })
})

describe('deleteTransaction', () => {
  it('removes the transaction and returns true', async () => {
    await insertTx('tx-1')
    expect(await deleteTransaction('tx-1')).toBe(true)
    expect(await getTransactionById('tx-1')).toBeUndefined()
  })

  it('returns false when nothing was deleted', async () => {
    expect(await deleteTransaction('missing')).toBe(false)
  })
})

describe('getTransactions', () => {
  beforeEach(async () => {
    await insertCategory('cat-a', 'Alpha')
    await insertCategory('cat-b', 'Beta')
    await insertTx('t-1', {
      name: 'Apple',
      type: 'expense',
      amount: 5000,
      dueDate: '2026-03-01',
      categoryId: 'cat-a',
    })
    await insertTx('t-2', {
      name: 'Banana',
      type: 'income',
      amount: 9000,
      dueDate: '2026-03-15',
      categoryId: 'cat-b',
    })
    await insertTx('t-3', {
      name: 'Cherry',
      type: 'expense',
      amount: 2000,
      isDone: true,
      dueDate: '2026-03-20',
    })
    // Zero-value row hidden by default
    await insertTx('t-zero', { name: 'Zero', amount: 0 })
  })

  it('hides zero-amount rows by default', async () => {
    const { transactions, pagination } = await getTransactions()
    expect(transactions.map((t) => t.id)).not.toContain('t-zero')
    expect(pagination.total).toBe(3)
  })

  it('shows zero-amount rows when hideZeroValue=false', async () => {
    const { transactions } = await getTransactions({ hideZeroValue: false })
    expect(transactions.map((t) => t.id)).toContain('t-zero')
  })

  it('filters by search (LIKE)', async () => {
    const { transactions } = await getTransactions({ search: 'App' })
    expect(transactions.map((t) => t.id)).toEqual(['t-1'])
  })

  it('filters by type', async () => {
    const { transactions } = await getTransactions({ type: 'income' })
    expect(transactions.map((t) => t.id)).toEqual(['t-2'])
  })

  it('filters by isDone', async () => {
    const { transactions } = await getTransactions({ isDone: true })
    expect(transactions.map((t) => t.id)).toEqual(['t-3'])
  })

  it('filters by date range', async () => {
    const { transactions } = await getTransactions({
      dateFrom: '2026-03-10',
      dateTo: '2026-03-20',
    })
    expect(transactions.map((t) => t.id).sort()).toEqual(['t-2', 't-3'])
  })

  it('filters by amount range', async () => {
    const { transactions } = await getTransactions({
      amountMin: 3000,
      amountMax: 6000,
    })
    expect(transactions.map((t) => t.id)).toEqual(['t-1'])
  })

  it('filters by categoryId', async () => {
    const { transactions } = await getTransactions({ categoryId: 'cat-a' })
    expect(transactions.map((t) => t.id)).toEqual(['t-1'])
  })

  it('filters by planId', async () => {
    const { transactions } = await getTransactions({ planId })
    expect(transactions).toHaveLength(3)
  })

  it('sorts by name asc', async () => {
    const { transactions } = await getTransactions({
      sortBy: 'name',
      sortDir: 'asc',
    })
    expect(transactions.map((t) => t.name)).toEqual([
      'Apple',
      'Banana',
      'Cherry',
    ])
  })

  it('sorts by amount with groupByType', async () => {
    const { transactions } = await getTransactions({
      sortBy: 'amount',
      sortDir: 'asc',
      groupByType: true,
    })
    // income first, then expenses
    expect(transactions[0].type).toBe('income')
    expect(transactions.at(-1)?.type).toBe('expense')
  })

  it('sorts by categoryName', async () => {
    const { transactions } = await getTransactions({
      sortBy: 'categoryName',
      sortDir: 'asc',
    })
    // Alpha < Beta; rows with null category come first or last depending on SQLite
    const named = transactions.filter((t) => t.categoryName !== null)
    expect(named.map((t) => t.categoryName)).toEqual(['Alpha', 'Beta'])
  })

  it('paginates results', async () => {
    const { transactions, pagination } = await getTransactions({
      limit: 2,
      page: 1,
    })
    expect(transactions).toHaveLength(2)
    expect(pagination.totalPages).toBe(2)
  })

  it('returns all results when limit=-1', async () => {
    const { transactions, pagination } = await getTransactions({ limit: -1 })
    expect(transactions).toHaveLength(3)
    expect(pagination.totalPages).toBe(1)
  })
})

describe('getPlanBalance', () => {
  it('returns zeros for plan with no transactions', async () => {
    expect(await getPlanBalance(planId)).toEqual({
      income: 0,
      expense: 0,
      net: 0,
    })
  })

  it('aggregates income and expense separately', async () => {
    await insertTx('i', { type: 'income', amount: 10000 })
    await insertTx('e1', { type: 'expense', amount: 3000 })
    await insertTx('e2', { type: 'expense', amount: 2000 })
    const balance = await getPlanBalance(planId)
    expect(balance).toEqual({ income: 10000, expense: 5000, net: 5000 })
  })
})

describe('getBudgetsForPlan', () => {
  it('returns only budget transactions for the plan', async () => {
    await insertTx('not-budget')
    await insertTx('budget-a', { isBudget: true, name: 'A' })
    await insertTx('budget-b', { isBudget: true, name: 'B' })
    const budgets = await getBudgetsForPlan(planId)
    expect(budgets.map((b) => b.id).sort()).toEqual(['budget-a', 'budget-b'])
  })
})

describe('getBudgetSpendingForBudgets', () => {
  it('returns empty record when no budget ids provided', async () => {
    expect(await getBudgetSpendingForBudgets([])).toEqual({})
  })

  it('aggregates bank transactions (absolute amounts) by budgetId', async () => {
    await insertSource()
    await insertTx('budget-a', { isBudget: true })
    await testDb.insert(plansSchema.bankTransaction).values([
      {
        id: 'bt-1',
        sourceId: 'src-1',
        dedupeKey: 'k-1',
        bookingDate: '2026-03-01',
        amountCents: -1500,
        currency: 'EUR',
        rawDataJson: '{}',
        status: 'booked',
        budgetId: 'budget-a',
        isArchived: false,
        isSplit: false,
        importSeenCount: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bt-2',
        sourceId: 'src-1',
        dedupeKey: 'k-2',
        bookingDate: '2026-03-02',
        amountCents: -500,
        currency: 'EUR',
        rawDataJson: '{}',
        status: 'booked',
        budgetId: 'budget-a',
        isArchived: false,
        isSplit: false,
        importSeenCount: 1,
        createdAt: now,
        updatedAt: now,
      },
    ])
    const spending = await getBudgetSpendingForBudgets(['budget-a'])
    expect(spending['budget-a']).toBe(2000)
  })
})

describe('getBudgetSpendingForPlan', () => {
  it('returns empty record when no budgets exist', async () => {
    const result = await getBudgetSpendingForPlan(planId)
    expect(result).toEqual({})
  })

  it('aggregates bank transactions and splits per plan budget', async () => {
    await insertSource()
    await insertTx('budget-a', { isBudget: true })
    await testDb.insert(plansSchema.bankTransaction).values({
      id: 'bt-1',
      sourceId: 'src-1',
      dedupeKey: 'k-1',
      bookingDate: '2026-03-01',
      amountCents: -1000,
      currency: 'EUR',
      rawDataJson: '{}',
      status: 'booked',
      planId,
      budgetId: 'budget-a',
      isArchived: false,
      isSplit: false,
      importSeenCount: 1,
      createdAt: now,
      updatedAt: now,
    })
    await testDb.insert(plansSchema.bankTransactionSplit).values({
      id: 'split-1',
      bankTransactionId: 'bt-1',
      amountCents: -500,
      planId,
      budgetId: 'budget-a',
      sortOrder: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })

    const spending = await getBudgetSpendingForPlan(planId)
    expect(spending['budget-a']).toBe(1500)
  })
})
