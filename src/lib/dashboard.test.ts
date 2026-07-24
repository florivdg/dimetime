import { beforeEach, describe, expect, it } from 'bun:test'
import { monthOffsetDate } from '@/lib/__fixtures__/dates'
import {
  seedCategory,
  seedPlan,
  seedPlannedTransaction,
} from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()

const { getDashboardStats, getMonthlyChartData } = await import('./dashboard')

async function insertPlanForMonth(
  id = 'plan-future',
  offsetMonths = 2,
  isArchived = false,
) {
  await seedPlan(testDb, {
    id,
    name: 'Plan',
    date: monthOffsetDate(offsetMonths, '01'),
    isArchived,
  })
  return id
}

function insertPlanForCurrentMonth(id = 'plan-current') {
  return insertPlanForMonth(id, 0)
}

async function insertCategory(
  id: string,
  name: string,
  color: string | null = '#fff',
) {
  await seedCategory(testDb, { id, name, slug: id, color })
}

async function insertTransaction({
  id,
  planId,
  amount,
  type,
  dueDate,
  isDone = false,
  categoryId = null,
}: {
  id: string
  planId: string | null
  amount: number
  type: 'income' | 'expense'
  dueDate: string
  isDone?: boolean
  categoryId?: string | null
}) {
  await seedPlannedTransaction(testDb, {
    id,
    name: id,
    type,
    dueDate,
    amount,
    isDone,
    planId,
    categoryId,
  })
}

describe('getDashboardStats', () => {
  it('returns null currentPlan when there is no plan at all (current or future)', async () => {
    const stats = await getDashboardStats()
    expect(stats.currentPlan).toBeNull()
    expect(stats.pendingTransactions).toEqual({
      count: 0,
      incomeTotal: 0,
      expenseTotal: 0,
    })
    expect(stats.topCategories).toEqual([])
  })

  it('falls back to the nearest upcoming plan when there is no current-month plan', async () => {
    const planId = await insertPlanForMonth()
    await insertCategory('cat-a', 'Miete')
    await insertTransaction({
      id: 't-income',
      planId,
      amount: 250000,
      type: 'income',
      dueDate: '2026-08-01',
    })
    await insertTransaction({
      id: 't-rent',
      planId,
      amount: 90000,
      type: 'expense',
      dueDate: '2026-08-01',
      categoryId: 'cat-a',
    })

    const stats = await getDashboardStats()
    expect(stats.currentPlan?.id).toBe(planId)
    expect(stats.currentPlan?.isUpcoming).toBe(true)
    expect(stats.currentPlan?.income).toBe(250000)
    expect(stats.currentPlan?.expense).toBe(90000)
    expect(stats.currentPlan?.net).toBe(160000)
    expect(stats.pendingTransactions.count).toBe(2)
    expect(stats.topCategories).toHaveLength(1)
    expect(stats.topCategories[0]?.name).toBe('Miete')
  })

  it('prefers the current-month plan over a future plan when both exist', async () => {
    const currentId = await insertPlanForCurrentMonth()
    await insertPlanForMonth()

    const stats = await getDashboardStats()
    expect(stats.currentPlan?.id).toBe(currentId)
    expect(stats.currentPlan?.isUpcoming).toBe(false)
  })

  it('aggregates balance, pending totals, and top categories for the current plan', async () => {
    const planId = await insertPlanForCurrentMonth()
    await insertCategory('cat-a', 'Miete')
    await insertCategory('cat-b', 'Lebensmittel')
    await insertCategory('cat-c', 'Strom')
    await insertCategory('cat-d', 'Sonstiges')

    await insertTransaction({
      id: 't-income-done',
      planId,
      amount: 200000,
      type: 'income',
      dueDate: '2026-03-01',
      isDone: true,
    })
    await insertTransaction({
      id: 't-rent',
      planId,
      amount: 100000,
      type: 'expense',
      dueDate: '2026-03-01',
      isDone: false,
      categoryId: 'cat-a',
    })
    await insertTransaction({
      id: 't-food',
      planId,
      amount: 30000,
      type: 'expense',
      dueDate: '2026-03-05',
      isDone: false,
      categoryId: 'cat-b',
    })
    await insertTransaction({
      id: 't-power',
      planId,
      amount: 20000,
      type: 'expense',
      dueDate: '2026-03-15',
      isDone: false,
      categoryId: 'cat-c',
    })
    await insertTransaction({
      id: 't-misc',
      planId,
      amount: 5000,
      type: 'expense',
      dueDate: '2026-03-20',
      isDone: false,
      categoryId: 'cat-d',
    })

    const stats = await getDashboardStats()
    expect(stats.currentPlan?.id).toBe(planId)
    expect(stats.currentPlan?.isUpcoming).toBe(false)
    expect(stats.currentPlan?.income).toBe(200000)
    expect(stats.currentPlan?.expense).toBe(155000)
    expect(stats.currentPlan?.net).toBe(45000)
    expect(stats.pendingTransactions.count).toBe(4)
    expect(stats.pendingTransactions.expenseTotal).toBe(155000)
    expect(stats.pendingTransactions.incomeTotal).toBe(0)

    // Top 3 categories by expense amount
    expect(stats.topCategories).toHaveLength(3)
    expect(stats.topCategories[0]?.name).toBe('Miete')
    expect(stats.topCategories[0]?.amount).toBe(100000)
    expect(stats.topCategories[0]?.percentage).toBe(65)
  })

  it('omits top categories when there is no expense total', async () => {
    const planId = await insertPlanForCurrentMonth()
    await insertCategory('cat-a', 'Lohn')
    await insertTransaction({
      id: 't-1',
      planId,
      amount: 200000,
      type: 'income',
      dueDate: '2026-03-01',
      categoryId: 'cat-a',
    })
    const stats = await getDashboardStats()
    expect(stats.topCategories).toEqual([])
  })
})

describe('getMonthlyChartData', () => {
  beforeEach(async () => {
    await insertPlanForCurrentMonth('p1')
  })

  it('returns empty result when no transactions exist', async () => {
    const result = await getMonthlyChartData('6m')
    expect(result).toEqual([])
  })

  it('aggregates income and expense per month within the range', async () => {
    await insertPlanForMonth('p-prev', -2)

    await insertTransaction({
      id: 'tx-now-income',
      planId: 'p1',
      amount: 100000,
      type: 'income',
      dueDate: monthOffsetDate(0),
    })
    await insertTransaction({
      id: 'tx-now-expense',
      planId: 'p1',
      amount: 50000,
      type: 'expense',
      dueDate: monthOffsetDate(0),
    })
    await insertTransaction({
      id: 'tx-prev-income',
      planId: 'p-prev',
      amount: 80000,
      type: 'income',
      dueDate: monthOffsetDate(-2),
    })

    const result = await getMonthlyChartData('6m')
    expect(result.length).toBe(2)
    expect(result.at(0)?.income).toBe(80000)
    const currentBucket = result.at(-1)
    expect(currentBucket?.income).toBe(100000)
    expect(currentBucket?.expense).toBe(50000)
  })

  it('buckets a transaction by its plan month, not by its due date', async () => {
    await insertTransaction({
      id: 'tx-stale-due-date',
      planId: 'p1',
      amount: 25000,
      type: 'expense',
      dueDate: monthOffsetDate(-2),
    })

    const result = await getMonthlyChartData('6m')
    expect(result.length).toBe(1)
    expect(result.at(0)?.expense).toBe(25000)
  })

  it('ignores transactions that belong to no plan', async () => {
    await insertTransaction({
      id: 'tx-orphan',
      planId: null,
      amount: 30000,
      type: 'expense',
      dueDate: monthOffsetDate(0),
    })

    const result = await getMonthlyChartData('6m')
    expect(result).toEqual([])
  })

  it('includes transactions from archived plans', async () => {
    await insertPlanForMonth('p-archived', 0, true)
    await insertTransaction({
      id: 'tx-archived',
      planId: 'p-archived',
      amount: 10000,
      type: 'expense',
      dueDate: monthOffsetDate(0),
    })

    const result = await getMonthlyChartData('6m')
    expect(result.length).toBe(1)
    expect(result.at(0)?.expense).toBe(10000)
  })

  it('handles 12m range (lookback 11 months)', async () => {
    const result = await getMonthlyChartData('12m')
    expect(Array.isArray(result)).toBe(true)
  })

  it('handles year range (since January)', async () => {
    const result = await getMonthlyChartData('year')
    expect(Array.isArray(result)).toBe(true)
  })
})
