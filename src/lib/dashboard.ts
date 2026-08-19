import { db } from '@/db/database'
import { plannedTransaction, category, plan } from '@/db/schema/plans'
import { and, asc, count, desc, eq, gte, sql, sum } from 'drizzle-orm'
import { getActivePlan, type Plan } from '@/lib/plans'
import { getPlanBalance } from '@/lib/transactions'
import { getInstallmentSummary } from '@/lib/installments'
import { currentMonth } from '@/lib/dates'

// Dashboard stats types
export interface CurrentPlanStats {
  id: string
  name: string | null
  date: string
  isUpcoming: boolean
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

export interface DashboardInstallment {
  id: string
  name: string
  amount: number // Monthly rate in cents
  paidCount: number
  totalInstallments: number
}

export interface InstallmentsStats {
  monthlyLoad: number // Cents due in the current month
  totalRemainingSum: number // Cents
  /** Up to 3 running plans, highest rate first; empty when none run. */
  top: DashboardInstallment[]
}

export interface DashboardStats {
  currentPlan: CurrentPlanStats | null
  pendingTransactions: PendingTransactionsStats
  topCategories: TopCategory[]
  installments: InstallmentsStats
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
 * Monthly load, remaining debt and the biggest running installment plans.
 * Everything comes from the Ratenzahlungen summary, which already ignores
 * paid-off plans.
 */
async function getInstallmentsStats(): Promise<InstallmentsStats> {
  const { running, aggregates } = await getInstallmentSummary(currentMonth())

  return {
    monthlyLoad: aggregates.currentMonthlyLoad,
    totalRemainingSum: aggregates.totalRemainingSum,
    top: running
      .toSorted((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((installment) => ({
        id: installment.id,
        name: installment.name,
        amount: installment.amount,
        paidCount: installment.paidCount,
        totalInstallments: installment.totalInstallments,
      })),
  }
}

/**
 * Build full dashboard stats for a specific plan.
 */
async function buildDashboardStatsForPlan(
  targetPlan: Plan,
  isUpcoming: boolean,
): Promise<DashboardStats> {
  const [balance, pending, categories, installments] = await Promise.all([
    getPlanBalance(targetPlan.id),
    getPendingTransactionsStats(targetPlan.id),
    getTopCategories(targetPlan.id),
    getInstallmentsStats(),
  ])

  return {
    currentPlan: {
      id: targetPlan.id,
      name: targetPlan.name,
      date: targetPlan.date,
      isUpcoming,
      ...balance,
    },
    pendingTransactions: pending,
    topCategories: categories,
    installments,
  }
}

/**
 * Get all dashboard stats for the current calendar month, falling back to
 * the nearest upcoming plan when no plan exists for the current month.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const active = await getActivePlan()

  if (!active) {
    return {
      currentPlan: null,
      pendingTransactions: {
        count: 0,
        incomeTotal: 0,
        expenseTotal: 0,
      },
      topCategories: [],
      installments: { monthlyLoad: 0, totalRemainingSum: 0, top: [] },
    }
  }

  return buildDashboardStatsForPlan(active.plan, active.isUpcoming)
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
 * Get monthly chart data based on range.
 *
 * Buckets by plan membership (the month of the transaction's plan), not by
 * due date, so a bar always matches the plan balance shown for that month.
 * Transactions without a plan are not part of any plan view and are ignored;
 * archived plans still count so past months keep their history.
 */
export async function getMonthlyChartData(
  range: ChartRange,
): Promise<MonthlyChartData[]> {
  const startDate = chartStartDate(range, new Date())
  const monthExpr = sql<string>`strftime('%Y-%m', ${plan.date})`

  const result = await db
    .select({
      month: monthExpr,
      type: plannedTransaction.type,
      total: sum(plannedTransaction.amount),
    })
    .from(plannedTransaction)
    .innerJoin(plan, eq(plannedTransaction.planId, plan.id))
    .where(gte(plan.date, startDate))
    .groupBy(monthExpr, plannedTransaction.type)
    .orderBy(asc(monthExpr))

  const monthlyMap = groupMonthlyRows(result)
  return Array.from(monthlyMap, ([month, data]) => ({
    month: new Date(`${month}-01`),
    income: data.income,
    expense: data.expense,
  }))
}
