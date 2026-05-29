import { beforeEach, describe, expect, it } from 'bun:test'
import {
  seedCategory,
  seedPlan,
  seedPlannedTransaction,
} from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()

const { getDashboardStats, getMonthlyChartData } = await import('./dashboard')

async function insertPlanForCurrentMonth(id = 'plan-current') {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  await seedPlan(testDb, { id, name: 'Current', date: `${currentMonth}-01` })
  return id
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
  it('returns empty stats when there is no current-month plan', async () => {
    const stats = await getDashboardStats()
    expect(stats.currentPlan).toBeNull()
    expect(stats.pendingTransactions).toEqual({
      count: 0,
      incomeTotal: 0,
      expenseTotal: 0,
    })
    expect(stats.topCategories).toEqual([])
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
    const today = new Date()
    const ym = (offsetMonths: number) => {
      const d = new Date(
        today.getFullYear(),
        today.getMonth() - offsetMonths,
        1,
      )
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`
    }

    await insertTransaction({
      id: 'tx-now-income',
      planId: 'p1',
      amount: 100000,
      type: 'income',
      dueDate: ym(0),
    })
    await insertTransaction({
      id: 'tx-now-expense',
      planId: 'p1',
      amount: 50000,
      type: 'expense',
      dueDate: ym(0),
    })
    await insertTransaction({
      id: 'tx-prev-income',
      planId: 'p1',
      amount: 80000,
      type: 'income',
      dueDate: ym(2),
    })

    const result = await getMonthlyChartData('6m')
    expect(result.length).toBeGreaterThan(0)
    const currentBucket = result.at(-1)
    expect(currentBucket?.income).toBe(100000)
    expect(currentBucket?.expense).toBe(50000)
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
