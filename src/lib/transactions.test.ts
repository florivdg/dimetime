import { beforeEach, describe, expect, it } from 'bun:test'
import {
  seedBankTransaction,
  seedBankTransactionSplit,
  seedCategory,
  seedImportSource,
  seedInstallmentPlan,
  seedPlan,
  seedPlannedTransaction,
  seedUser,
} from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()

const {
  adjustDueDateToMonth,
  BudgetLinksConfirmationRequiredError,
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

const planId = 'plan-1'
const archivedPlanId = 'plan-archived'

async function insertPlan(id: string, isArchived = false) {
  await seedPlan(testDb, { id, name: id, isArchived })
}

async function insertCategory(
  id: string,
  name = id,
  color: string | null = null,
) {
  await seedCategory(testDb, { id, name, slug: id, color })
}

async function insertSource(id = 'src-1') {
  await seedImportSource(testDb, { id, name: id })
}

async function insertTx(
  id: string,
  overrides: Parameters<typeof seedPlannedTransaction>[1] = {},
) {
  await seedPlannedTransaction(testDb, {
    id,
    name: id,
    dueDate: '2026-03-15',
    planId,
    ...overrides,
  })
}

/** Seed a bank transaction linked to `budget-tx` via `budgetId` (id `bt-1`). */
async function insertBudgetBankTx(
  overrides: Parameters<typeof seedBankTransaction>[1] = {},
) {
  await seedBankTransaction(testDb, {
    id: 'bt-1',
    sourceId: 'src-1',
    dedupeKey: 'k-1',
    bookingDate: '2026-03-15',
    planId,
    planAssignment: 'manual',
    budgetId: 'budget-tx',
    ...overrides,
  })
}

/** Read back the seeded `bt-1` bank transaction. */
async function bt1() {
  return testDb.query.bankTransaction.findFirst({
    where: (t, { eq: e }) => e(t.id, 'bt-1'),
  })
}

/** Seed a split of `bt-1` linked to `budget-tx` via `budgetId` (id `sp-1`). */
async function insertBudgetSplit(
  overrides: Parameters<typeof seedBankTransactionSplit>[1] = {},
) {
  await seedBankTransactionSplit(testDb, {
    id: 'sp-1',
    bankTransactionId: 'bt-1',
    planId,
    budgetId: 'budget-tx',
    ...overrides,
  })
}

/** Read back the `budgetId` of the seeded `sp-1` split. */
async function sp1BudgetId(): Promise<string | null | undefined> {
  const split = await testDb.query.bankTransactionSplit.findFirst({
    where: (t, { eq: e }) => e(t.id, 'sp-1'),
  })
  return split?.budgetId
}

beforeEach(async () => {
  await insertPlan(planId)
  await insertPlan(archivedPlanId, true)
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

/** A completion time clearly apart from any `now` the tests run at. */
const DONE_AT = new Date('2026-01-02T03:04:05Z')

/** Assert `value` is a Date stamped no earlier than `before` and not in the future. */
function expectStampedSince(value: Date | null | undefined, before: number) {
  expect(value).toBeInstanceOf(Date)
  expect(value!.getTime()).toBeGreaterThanOrEqual(before)
  expect(value!.getTime()).toBeLessThanOrEqual(Date.now())
}

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
    expect(tx.completedAt).toBeNull()
    expect(tx.isBudget).toBe(false)
    expect(tx.note).toBeNull()
    expect(tx.categoryId).toBeNull()
  })

  it('stamps completedAt when created as done', async () => {
    const before = Date.now()
    const tx = await createTransaction({
      name: 'Erledigt',
      planId,
      dueDate: '2026-03-10',
      amount: 5000,
      isDone: true,
    })
    expectStampedSince(tx.completedAt, before)
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
      null,
    )
    expect(result).toBeNull()
  })

  it('rejects when nextPlanId equals currentPlanId', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      planId,
      async () => ({ isArchived: false }),
      null,
    )
    expect(result?.status).toBe(400)
  })

  it('returns 404 when target plan does not exist', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      'missing',
      async () => undefined,
      null,
    )
    expect(result?.status).toBe(404)
  })

  it('returns 403 when target plan is archived', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      'p-other',
      async () => ({ isArchived: true }),
      null,
    )
    expect(result?.status).toBe(403)
  })

  it('returns null on a valid plan move', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      'p-other',
      async () => ({ isArchived: false }),
      null,
    )
    expect(result).toBeNull()
  })

  it('rejects moving an installment-linked row with 409', async () => {
    const result = await validateTransactionPlanChange(
      planId,
      'p-other',
      async () => ({ isArchived: false }),
      'ip1',
    )
    expect(result).toEqual({
      message:
        'Raten-Posten können nicht in einen anderen Plan verschoben werden',
      status: 409,
    })
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

  it('requires confirmation when the plan is changed', async () => {
    await insertPlan('plan-2')
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await insertBudgetBankTx()

    expect(
      updateTransaction('budget-tx', { planId: 'plan-2' }),
    ).rejects.toThrow(BudgetLinksConfirmationRequiredError)
  })

  it('requires confirmation when isBudget is set to false', async () => {
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await insertBudgetBankTx()

    expect(updateTransaction('budget-tx', { isBudget: false })).rejects.toThrow(
      BudgetLinksConfirmationRequiredError,
    )
  })

  it('reports the affected bank transactions and splits on the error', async () => {
    await insertPlan('plan-2')
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await insertBudgetBankTx()
    await insertBudgetSplit()
    await insertBudgetSplit({ id: 'sp-2', isArchived: true })

    const err = await updateTransaction('budget-tx', {
      planId: 'plan-2',
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(BudgetLinksConfirmationRequiredError)
    const typed = err as InstanceType<
      typeof BudgetLinksConfirmationRequiredError
    >
    expect(typed.bankTransactions).toBe(1)
    expect(typed.splits).toBe(2)
  })

  it('leaves everything untouched when confirmation is missing', async () => {
    await insertPlan('plan-2')
    await insertSource()
    await insertTx('budget-tx', { isBudget: true, name: 'Budget' })
    await insertBudgetBankTx()
    await insertBudgetSplit()

    await updateTransaction('budget-tx', {
      planId: 'plan-2',
      name: 'Verschoben',
    }).catch(() => undefined)

    const tx = await getTransactionById('budget-tx')
    expect(tx?.planId).toBe(planId)
    expect(tx?.name).toBe('Budget')
    expect((await bt1())?.budgetId).toBe('budget-tx')
    expect(await sp1BudgetId()).toBe('budget-tx')
  })

  it('clears bank-transaction and split budgetId once confirmed', async () => {
    await insertPlan('plan-2')
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await insertBudgetBankTx()
    await insertBudgetSplit()

    const updated = await updateTransaction('budget-tx', {
      planId: 'plan-2',
      confirmClearBudgetLinks: true,
    })

    expect(updated?.planId).toBe('plan-2')
    expect((await bt1())?.budgetId).toBeNull()
    expect(await sp1BudgetId()).toBeNull()
  })

  it('requires confirmation when only a pre-split reference exists', async () => {
    await insertPlan('plan-2')
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await insertBudgetBankTx({
      isSplit: true,
      budgetId: null,
      preSplitBudgetId: 'budget-tx',
    })

    const err = await updateTransaction('budget-tx', {
      planId: 'plan-2',
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(BudgetLinksConfirmationRequiredError)
    const typed = err as InstanceType<
      typeof BudgetLinksConfirmationRequiredError
    >
    expect(typed.bankTransactions).toBe(1)
  })

  it('clears preSplitBudgetId once confirmed', async () => {
    await insertPlan('plan-2')
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await insertBudgetBankTx({
      isSplit: true,
      budgetId: null,
      preSplitBudgetId: 'budget-tx',
    })

    const updated = await updateTransaction('budget-tx', {
      planId: 'plan-2',
      confirmClearBudgetLinks: true,
    })

    expect(updated?.planId).toBe('plan-2')
    expect((await bt1())?.preSplitBudgetId).toBeNull()
  })

  it('needs no confirmation when no links exist', async () => {
    await insertPlan('plan-2')
    await insertTx('budget-tx', { isBudget: true })

    const updated = await updateTransaction('budget-tx', { planId: 'plan-2' })
    expect(updated?.planId).toBe('plan-2')
  })

  it('does not clear budgetId when plan and isBudget unchanged', async () => {
    await insertSource()
    await insertTx('budget-tx', { isBudget: true })
    await insertBudgetBankTx()

    await updateTransaction('budget-tx', { name: 'Renamed' })
    expect((await bt1())?.budgetId).toBe('budget-tx')
  })

  it('stamps completedAt when an open row is marked done', async () => {
    await insertTx('tx-1')
    const before = Date.now()
    const updated = await updateTransaction('tx-1', { isDone: true })
    expectStampedSince(updated?.completedAt, before)
  })

  const doneRowCases: [
    title: string,
    seeded: Date | null,
    input: Parameters<typeof updateTransaction>[1],
    expected: Date | null,
  ][] = [
    [
      'keeps completedAt when a done row is marked done again',
      DONE_AT,
      { isDone: true },
      DONE_AT,
    ],
    [
      'keeps completedAt null when a legacy done row is marked done again',
      null,
      { isDone: true },
      null,
    ],
    [
      'clears completedAt when a done row is reopened',
      DONE_AT,
      { isDone: false },
      null,
    ],
    [
      'leaves completedAt untouched when isDone is not updated',
      DONE_AT,
      { name: 'Renamed' },
      DONE_AT,
    ],
  ]

  for (const [title, seeded, input, expected] of doneRowCases) {
    it(title, async () => {
      await insertTx('tx-1', { isDone: true, completedAt: seeded })
      const updated = await updateTransaction('tx-1', input)
      expect(updated?.completedAt).toEqual(expected)
    })
  }
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
    await seedBankTransaction(testDb, {
      id: 'bt-1',
      sourceId: 'src-1',
      dedupeKey: 'k-1',
      bookingDate: '2026-03-01',
      amountCents: -1500,
      budgetId: 'budget-a',
    })
    await seedBankTransaction(testDb, {
      id: 'bt-2',
      sourceId: 'src-1',
      dedupeKey: 'k-2',
      bookingDate: '2026-03-02',
      amountCents: -500,
      budgetId: 'budget-a',
    })
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
    await seedBankTransaction(testDb, {
      id: 'bt-1',
      sourceId: 'src-1',
      dedupeKey: 'k-1',
      bookingDate: '2026-03-01',
      planId,
      budgetId: 'budget-a',
    })
    await seedBankTransactionSplit(testDb, {
      id: 'split-1',
      bankTransactionId: 'bt-1',
      amountCents: -500,
      planId,
      budgetId: 'budget-a',
    })

    const spending = await getBudgetSpendingForPlan(planId)
    expect(spending['budget-a']).toBe(1500)
  })
})

describe('getTransactions installment badges', () => {
  beforeEach(async () => {
    await seedUser(testDb, { id: 'u1' })
    await seedInstallmentPlan(testDb, {
      id: 'ip-1',
      name: 'Laptop',
      totalInstallments: 12,
      prepaidInstallments: 3,
      userId: 'u1',
    })
    await insertTx('rate-1', {
      name: 'Laptop',
      dueDate: '2026-03-01',
      installmentId: 'ip-1',
    })
    // Second rate lives in another plan: (plan_id, installment_id) is unique
    await insertPlan('plan-2')
    await insertTx('rate-2', {
      name: 'Laptop',
      dueDate: '2026-04-01',
      planId: 'plan-2',
      installmentId: 'ip-1',
    })
    await insertTx('plain', { name: 'Miete', dueDate: '2026-03-05' })
  })

  it('adds the rate position to installment-linked rows of a plan', async () => {
    const { transactions } = await getTransactions({ planId })
    const byId = new Map(transactions.map((t) => [t.id, t]))

    expect(byId.get('rate-1')?.installmentName).toBe('Laptop')
    expect(byId.get('rate-1')?.ratePosition).toBe(4)
    expect(byId.get('rate-1')?.rateTotal).toBe(12)

    // The rank counts across plans, not just within the queried one
    const second = await getTransactions({ planId: 'plan-2' })
    expect(second.transactions[0].ratePosition).toBe(5)
  })

  it('leaves regular rows of a plan without badge fields', async () => {
    const { transactions } = await getTransactions({
      planId,
      search: 'Miete',
    })
    expect(transactions[0].installmentName).toBeNull()
    expect(transactions[0].ratePosition).toBeNull()
    expect(transactions[0].rateTotal).toBeNull()
  })

  it('omits the badges entirely on an unscoped query', async () => {
    const { transactions } = await getTransactions({
      sortBy: 'dueDate',
      sortDir: 'asc',
    })
    const byId = new Map(transactions.map((t) => [t.id, t]))

    expect(byId.get('rate-1')?.installmentName).toBeNull()
    expect(byId.get('rate-1')?.ratePosition).toBeNull()
    expect(byId.get('rate-1')?.rateTotal).toBeNull()
  })
})
