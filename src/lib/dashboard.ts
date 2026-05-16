import { db } from '@/db/database'
import { plannedTransaction, category } from '@/db/schema/plans'
import { and, asc, count, desc, eq, gte, sql, sum } from 'drizzle-orm'
import { getCurrentMonthPlan } from '@/lib/plans'
import { getPlanBalance } from '@/lib/transactions'

// Dashboard stats types
export interface CurrentPlanStats {
  id: string
  name: string | null
  date: string
  income: number
  expense: number
  net: number
}

export interface PendingTransactionsStats {
  count: number
  incomeTotal: number
  expenseTotal: number
}

export interface TopCategory {
  id: string
  name: string
  color: string | null
  amount: number
  percentage: number
}

export interface DashboardStats {
  currentPlan: CurrentPlanStats | null
  pendingTransactions: PendingTransactionsStats
  topCategories: TopCategory[]
}

export interface MonthlyChartData {
  month: Date
  income: number
  expense: number
}

export type ChartRange = '6m' | '12m' | 'year'

type PendingTotalRow = {
  type: 'income' | 'expense'
  count: number
  total: string | null
}

function applyPendingRow(
  stats: PendingTransactionsStats,
  row: PendingTotalRow,
): void {
  const rowTotal = Number(row.total) || 0
  stats.count += row.count ?? 0
  if (row.type === 'income') stats.incomeTotal = rowTotal
  else stats.expenseTotal = rowTotal
}

function aggregatePendingTotals(
  rows: PendingTotalRow[],
): PendingTransactionsStats {
  const stats: PendingTransactionsStats = {
    count: 0,
    incomeTotal: 0,
    expenseTotal: 0,
  }
  for (const row of rows) applyPendingRow(stats, row)
  return stats
}

/**
 * Get pending transactions stats for a plan
 */
async function getPendingTransactionsStats(
  planId: string,
): Promise<PendingTransactionsStats> {
  const totalsResult = await db
    .select({
      type: plannedTransaction.type,
      count: count(),
      total: sum(plannedTransaction.amount),
    })
    .from(plannedTransaction)
    .where(
      and(
        eq(plannedTransaction.planId, planId),
        eq(plannedTransaction.isDone, false),
      ),
    )
    .groupBy(plannedTransaction.type)

  return aggregatePendingTotals(totalsResult)
}

/**
 * Get top expense categories for a plan
 */
async function getTopCategories(planId: string): Promise<TopCategory[]> {
  // Get total expenses for percentage calculation
  const totalExpenseResult = await db
    .select({
      total: sum(plannedTransaction.amount),
    })
    .from(plannedTransaction)
    .where(
      and(
        eq(plannedTransaction.planId, planId),
        eq(plannedTransaction.type, 'expense'),
      ),
    )

  const totalExpense = Number(totalExpenseResult[0]?.total) || 0

  if (totalExpense === 0) {
    return []
  }

  // Get top 3 categories by expense amount
  const categoriesResult = await db
    .select({
      id: category.id,
      name: category.name,
      color: category.color,
      total: sum(plannedTransaction.amount),
    })
    .from(plannedTransaction)
    .innerJoin(category, eq(plannedTransaction.categoryId, category.id))
    .where(
      and(
        eq(plannedTransaction.planId, planId),
        eq(plannedTransaction.type, 'expense'),
      ),
    )
    .groupBy(category.id)
    .orderBy(desc(sum(plannedTransaction.amount)))
    .limit(3)

  return categoriesResult.map((row) => {
    const amount = Number(row.total) || 0
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      amount,
      percentage: Math.round((amount / totalExpense) * 100),
    }
  })
}

/**
 * Get all dashboard stats for the current calendar month
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const currentPlan = await getCurrentMonthPlan()

  if (!currentPlan) {
    return {
      currentPlan: null,
      pendingTransactions: {
        count: 0,
        incomeTotal: 0,
        expenseTotal: 0,
      },
      topCategories: [],
    }
  }

  const [balance, pending, categories] = await Promise.all([
    getPlanBalance(currentPlan.id),
    getPendingTransactionsStats(currentPlan.id),
    getTopCategories(currentPlan.id),
  ])

  return {
    currentPlan: {
      id: currentPlan.id,
      name: currentPlan.name,
      date: currentPlan.date,
      ...balance,
    },
    pendingTransactions: pending,
    topCategories: categories,
  }
}

function chartStartDate(range: ChartRange, now: Date): string {
  const lookback = { '6m': 5, '12m': 11, year: now.getMonth() }[range]
  const startMonth = now.getMonth() - lookback
  const year = now.getFullYear() + Math.floor(startMonth / 12)
  const month = ((startMonth % 12) + 12) % 12
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

type MonthRow = {
  month: string
  type: 'income' | 'expense'
  total: string | null
}

type MonthBucket = { income: number; expense: number }

function applyMonthRow(map: Map<string, MonthBucket>, row: MonthRow): void {
  const data = map.get(row.month) ?? { income: 0, expense: 0 }
  const total = Number(row.total) || 0
  if (row.type === 'income') data.income = total
  else data.expense = total
  map.set(row.month, data)
}

function groupMonthlyRows(rows: MonthRow[]): Map<string, MonthBucket> {
  const monthlyMap = new Map<string, MonthBucket>()
  for (const row of rows) applyMonthRow(monthlyMap, row)
  return monthlyMap
}

/**
 * Get monthly chart data based on range
 */
export async function getMonthlyChartData(
  range: ChartRange,
): Promise<MonthlyChartData[]> {
  const startDate = chartStartDate(range, new Date())

  const result = await db
    .select({
      month: sql<string>`strftime('%Y-%m', ${plannedTransaction.dueDate})`,
      type: plannedTransaction.type,
      total: sum(plannedTransaction.amount),
    })
    .from(plannedTransaction)
    .where(gte(plannedTransaction.dueDate, startDate))
    .groupBy(
      sql`strftime('%Y-%m', ${plannedTransaction.dueDate})`,
      plannedTransaction.type,
    )
    .orderBy(asc(sql`strftime('%Y-%m', ${plannedTransaction.dueDate})`))

  const monthlyMap = groupMonthlyRows(result)
  return Array.from(monthlyMap, ([month, data]) => ({
    month: new Date(`${month}-01`),
    income: data.income,
    expense: data.expense,
  }))
}
