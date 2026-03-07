import { db } from '@/db/database'
import {
  bankTransaction,
  plannedTransaction,
  category,
  plan,
} from '@/db/schema/plans'
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  like,
  lte,
  ne,
  sum,
} from 'drizzle-orm'

// Infer types from Drizzle schema
export type Transaction = typeof plannedTransaction.$inferSelect
export type NewTransaction = typeof plannedTransaction.$inferInsert

// Transaction with category and plan details for display
export type TransactionWithCategory = Transaction & {
  categoryName: string | null
  categoryColor: string | null
  planName: string | null
  planDate: string | null
  planIsArchived: boolean
}

// Transaction with plan archive status for API validation
export type TransactionWithPlanStatus = Transaction & {
  planIsArchived: boolean
}

// Pagination response type
export interface PaginatedTransactions {
  transactions: TransactionWithCategory[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// Query options type
export interface TransactionQueryOptions {
  search?: string
  categoryId?: string
  planId?: string
  type?: 'income' | 'expense'
  isDone?: boolean
  dateFrom?: string
  dateTo?: string
  amountMin?: number
  amountMax?: number
  hideZeroValue?: boolean
  sortBy?: 'name' | 'dueDate' | 'categoryName' | 'amount'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
  groupByType?: boolean
}

// Create input type
export interface CreateTransactionInput {
  name: string
  note?: string | null
  type?: 'income' | 'expense'
  dueDate: string
  amount: number
  isDone?: boolean
  isBudget?: boolean
  planId: string
  categoryId?: string | null
}

// Plan balance type
export interface PlanBalance {
  income: number
  expense: number
  net: number
}

// Update input type
export interface UpdateTransactionInput {
  name?: string
  note?: string | null
  type?: 'income' | 'expense'
  dueDate?: string
  amount?: number
  isDone?: boolean
  isBudget?: boolean
  categoryId?: string | null
  planId?: string
}

/**
 * Get paginated transactions with optional filtering and sorting
 */
export async function getTransactions(
  options: TransactionQueryOptions = {},
): Promise<PaginatedTransactions> {
  const {
    search,
    categoryId,
    planId,
    type,
    isDone,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    hideZeroValue = true,
    sortBy = 'dueDate',
    sortDir = 'desc',
    page = 1,
    limit = 20,
    groupByType = false,
  } = options

  // Build where conditions
  const conditions = []

  if (search) {
    conditions.push(like(plannedTransaction.name, `%${search}%`))
  }

  if (categoryId) {
    conditions.push(eq(plannedTransaction.categoryId, categoryId))
  }

  if (planId) {
    conditions.push(eq(plannedTransaction.planId, planId))
  }

  if (type) {
    conditions.push(eq(plannedTransaction.type, type))
  }

  if (isDone !== undefined) {
    conditions.push(eq(plannedTransaction.isDone, isDone))
  }

  if (dateFrom) {
    conditions.push(gte(plannedTransaction.dueDate, dateFrom))
  }

  if (dateTo) {
    conditions.push(lte(plannedTransaction.dueDate, dateTo))
  }

  if (amountMin !== undefined) {
    conditions.push(gte(plannedTransaction.amount, amountMin))
  }

  if (amountMax !== undefined) {
    conditions.push(lte(plannedTransaction.amount, amountMax))
  }

  if (hideZeroValue) {
    conditions.push(ne(plannedTransaction.amount, 0))
  }

  const whereClause =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions)

  // Determine sort column
  const sortColumn =
    sortBy === 'name'
      ? plannedTransaction.name
      : sortBy === 'amount'
        ? plannedTransaction.amount
        : sortBy === 'categoryName'
          ? category.name
          : plannedTransaction.dueDate

  const orderFn = sortDir === 'asc' ? asc : desc

  // Get total count for pagination
  const countResult = await db
    .select({ count: count() })
    .from(plannedTransaction)
    .leftJoin(category, eq(plannedTransaction.categoryId, category.id))
    .where(whereClause)

  const total = countResult[0]?.count ?? 0
  const totalPages = limit === -1 ? 1 : Math.ceil(total / limit)

  // Get transactions with category and plan info
  // When groupByType is enabled and sorting by amount, group by income/expense first
  const orderByClause =
    sortBy === 'amount' && groupByType
      ? [desc(plannedTransaction.type), orderFn(plannedTransaction.amount)]
      : [orderFn(sortColumn)]

  const query = db
    .select({
      ...getTableColumns(plannedTransaction),
      categoryName: category.name,
      categoryColor: category.color,
      planName: plan.name,
      planDate: plan.date,
      planIsArchived: plan.isArchived,
    })
    .from(plannedTransaction)
    .leftJoin(category, eq(plannedTransaction.categoryId, category.id))
    .leftJoin(plan, eq(plannedTransaction.planId, plan.id))
    .where(whereClause)
    .orderBy(...orderByClause)

  const rawResult =
    limit === -1
      ? await query
      : await query.limit(limit).offset((page - 1) * limit)

  // Ensure planIsArchived is always a boolean (not null)
  const result: TransactionWithCategory[] = rawResult.map((row) => ({
    ...row,
    planIsArchived: row.planIsArchived ?? false,
  }))

  return {
    transactions: result,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  }
}

/**
 * Get a single transaction by ID
 */
export async function getTransactionById(
  id: string,
): Promise<Transaction | undefined> {
  return db.query.plannedTransaction.findFirst({
    where: eq(plannedTransaction.id, id),
  })
}

/**
 * Get a transaction by ID with its plan's archived status
 * Used for checking if modifications are allowed
 */
export async function getTransactionWithPlanStatus(
  id: string,
): Promise<TransactionWithPlanStatus | undefined> {
  const result = await db
    .select({
      ...getTableColumns(plannedTransaction),
      planIsArchived: plan.isArchived,
    })
    .from(plannedTransaction)
    .leftJoin(plan, eq(plannedTransaction.planId, plan.id))
    .where(eq(plannedTransaction.id, id))
    .limit(1)

  if (result.length === 0) return undefined

  return {
    ...result[0],
    planIsArchived: result[0].planIsArchived ?? false,
  }
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<Transaction | undefined> {
  const now = new Date()
  const updateData: {
    name?: string
    note?: string | null
    type?: 'income' | 'expense'
    dueDate?: string
    amount?: number
    isDone?: boolean
    isBudget?: boolean
    categoryId?: string | null
    planId?: string
    updatedAt: Date
  } = {
    updatedAt: now,
  }

  if (input.name !== undefined) updateData.name = input.name
  if (input.note !== undefined) updateData.note = input.note
  if (input.type !== undefined) updateData.type = input.type
  if (input.dueDate !== undefined) updateData.dueDate = input.dueDate
  if (input.amount !== undefined) updateData.amount = input.amount
  if (input.isDone !== undefined) updateData.isDone = input.isDone
  if (input.isBudget !== undefined) updateData.isBudget = input.isBudget
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId
  if (input.planId !== undefined) updateData.planId = input.planId

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        planId: plannedTransaction.planId,
        isBudget: plannedTransaction.isBudget,
      })
      .from(plannedTransaction)
      .where(eq(plannedTransaction.id, id))
      .limit(1)

    if (!existing) {
      return undefined
    }

    const nextPlanId = input.planId ?? existing.planId
    const nextIsBudget = input.isBudget ?? existing.isBudget

    if (!nextIsBudget || nextPlanId !== existing.planId) {
      await tx
        .update(bankTransaction)
        .set({
          budgetId: null,
          updatedAt: now,
        })
        .where(eq(bankTransaction.budgetId, id))
    }

    const result = await tx
      .update(plannedTransaction)
      .set(updateData)
      .where(eq(plannedTransaction.id, id))
      .returning()

    return result[0]
  })
}

/**
 * Delete a transaction by ID
 */
export async function deleteTransaction(id: string): Promise<boolean> {
  const result = await db
    .delete(plannedTransaction)
    .where(eq(plannedTransaction.id, id))
    .returning({ id: plannedTransaction.id })
  return result.length > 0
}

/**
 * Create a new transaction
 */
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  const now = new Date()
  const result = await db
    .insert(plannedTransaction)
    .values({
      name: input.name,
      note: input.note ?? null,
      type: input.type ?? 'expense',
      dueDate: input.dueDate,
      amount: input.amount,
      isDone: input.isDone ?? false,
      isBudget: input.isBudget ?? false,
      planId: input.planId,
      categoryId: input.categoryId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return result[0]
}

/**
 * Get balance for a plan (sum of income and expense)
 */
export async function getPlanBalance(planId: string): Promise<PlanBalance> {
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

  return {
    income,
    expense,
    net: income - expense,
  }
}

/**
 * Get budget transactions for a plan
 */
export async function getBudgetsForPlan(planId: string) {
  return db
    .select({
      id: plannedTransaction.id,
      name: plannedTransaction.name,
    })
    .from(plannedTransaction)
    .where(
      and(
        eq(plannedTransaction.planId, planId),
        eq(plannedTransaction.isBudget, true),
      ),
    )
    .orderBy(asc(plannedTransaction.name))
}

/**
 * Get budget spending for a plan (sum of absolute bank transaction amounts grouped by budgetId)
 */
export async function getBudgetSpendingForPlan(
  planId: string,
): Promise<Record<string, number>> {
  const result = await db
    .select({
      budgetId: bankTransaction.budgetId,
      spent: sum(bankTransaction.amountCents),
    })
    .from(bankTransaction)
    .innerJoin(
      plannedTransaction,
      eq(bankTransaction.budgetId, plannedTransaction.id),
    )
    .where(
      and(
        eq(plannedTransaction.planId, planId),
        eq(plannedTransaction.isBudget, true),
      ),
    )
    .groupBy(bankTransaction.budgetId)

  const spending: Record<string, number> = {}
  for (const row of result) {
    if (row.budgetId) {
      spending[row.budgetId] = Math.abs(Number(row.spent) || 0)
    }
  }
  return spending
}

/**
 * Adjusts a dueDate to a new plan month while keeping the day.
 * Clamps day to the last day of the month if needed.
 * @param sourceDueDate - Source date in YYYY-MM-DD format
 * @param targetPlanDate - Target plan date in YYYY-MM-DD format
 * @returns Adjusted date in YYYY-MM-DD format
 */
export function adjustDueDateToMonth(
  sourceDueDate: string,
  targetPlanDate: string,
): string {
  const sourceDay = parseInt(sourceDueDate.split('-')[2], 10)
  const [targetYear, targetMonth] = targetPlanDate.split('-').map(Number)

  // Get last day of target month
  const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate()
  const adjustedDay = Math.min(sourceDay, lastDayOfMonth)

  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`
}
