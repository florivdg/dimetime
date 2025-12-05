import { db } from '@/db/database'
import { plannedTransaction, category, plan } from '@/db/schema/plans'
import { and, asc, count, desc, eq, gte, sql, sum } from 'drizzle-orm'

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

/**
 * Get the current (latest non-archived) plan
 */
async function getCurrentPlan() {
  const result = await db
    .select()
    .from(plan)
    .where(eq(plan.isArchived, false))
    .orderBy(desc(plan.date))
    .limit(1)

  return result[0] ?? null
}

/**
 * Get balance for a plan (income, expense, net)
 */
async function getPlanBalance(planId: string) {
  const result = await db
    .select({
      type: plannedTransaction.type,
      total: sum(plannedTransaction.amount),
    })
    .from(plannedTransaction)
    .where(eq(plannedTransaction.planId, planId))
    .groupBy(plannedTransaction.type)

  let income = 0
  let expense = 0

  for (const row of result) {
    const total = Number(row.total) || 0
    if (row.type === 'income') {
      income = total
    } else {
      expense = total
    }
  }

  return { income, expense, net: income - expense }
}

/**
 * Get pending transactions stats for a plan
 */
async function getPendingTransactionsStats(
  planId: string,
): Promise<PendingTransactionsStats> {
  // Get counts and totals by type
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

  let totalCount = 0
  let incomeTotal = 0
  let expenseTotal = 0

  for (const row of totalsResult) {
    const rowCount = row.count ?? 0
    const rowTotal = Number(row.total) || 0
    totalCount += rowCount
    if (row.type === 'income') {
      incomeTotal = rowTotal
    } else {
      expenseTotal = rowTotal
    }
  }

  return {
    count: totalCount,
    incomeTotal,
    expenseTotal,
  }
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
 * Get all dashboard stats
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const currentPlan = await getCurrentPlan()

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

/**
 * Get monthly chart data based on range
 */
export async function getMonthlyChartData(
  range: ChartRange,
): Promise<MonthlyChartData[]> {
  const now = new Date()
  let startDate: string

  if (range === '6m') {
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    startDate = sixMonthsAgo.toISOString().slice(0, 10)
  } else if (range === '12m') {
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    startDate = twelveMonthsAgo.toISOString().slice(0, 10)
  } else {
    // Current year
    startDate = `${now.getFullYear()}-01-01`
  }

  // Get aggregated monthly data
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

  // Group by month and combine income/expense
  const monthlyMap = new Map<string, { income: number; expense: number }>()

  for (const row of result) {
    const month = row.month
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { income: 0, expense: 0 })
    }
    const data = monthlyMap.get(month)!
    const total = Number(row.total) || 0
    if (row.type === 'income') {
      data.income = total
    } else {
      data.expense = total
    }
  }

  // Convert to array with Date objects
  const chartData: MonthlyChartData[] = []
  for (const [month, data] of monthlyMap) {
    chartData.push({
      month: new Date(`${month}-01`),
      income: data.income,
      expense: data.expense,
    })
  }

  return chartData
}
