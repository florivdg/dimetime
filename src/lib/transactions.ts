import { db } from '@/db/database'
import { plannedTransaction, category, plan } from '@/db/schema/plans'
import { and, asc, count, desc, eq, getTableColumns, like } from 'drizzle-orm'

// Infer types from Drizzle schema
export type Transaction = typeof plannedTransaction.$inferSelect
export type NewTransaction = typeof plannedTransaction.$inferInsert

// Transaction with category and plan details for display
export type TransactionWithCategory = Transaction & {
  categoryName: string | null
  categoryColor: string | null
  planName: string | null
  planDate: string | null
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
  sortBy?: 'name' | 'dueDate' | 'categoryName' | 'amount'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// Update input type
export interface UpdateTransactionInput {
  name?: string
  note?: string | null
  type?: 'income' | 'expense'
  dueDate?: string
  amount?: number
  isDone?: boolean
  categoryId?: string | null
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
    sortBy = 'dueDate',
    sortDir = 'desc',
    page = 1,
    limit = 20,
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
  const totalPages = Math.ceil(total / limit)

  // Get paginated transactions with category and plan info
  const result = await db
    .select({
      ...getTableColumns(plannedTransaction),
      categoryName: category.name,
      categoryColor: category.color,
      planName: plan.name,
      planDate: plan.date,
    })
    .from(plannedTransaction)
    .leftJoin(category, eq(plannedTransaction.categoryId, category.id))
    .leftJoin(plan, eq(plannedTransaction.planId, plan.id))
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset((page - 1) * limit)

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
 * Update an existing transaction
 */
export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<Transaction | undefined> {
  const updateData: {
    name?: string
    note?: string | null
    type?: 'income' | 'expense'
    dueDate?: string
    amount?: number
    isDone?: boolean
    categoryId?: string | null
    updatedAt: Date
  } = {
    updatedAt: new Date(),
  }

  if (input.name !== undefined) updateData.name = input.name
  if (input.note !== undefined) updateData.note = input.note
  if (input.type !== undefined) updateData.type = input.type
  if (input.dueDate !== undefined) updateData.dueDate = input.dueDate
  if (input.amount !== undefined) updateData.amount = input.amount
  if (input.isDone !== undefined) updateData.isDone = input.isDone
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId

  const result = await db
    .update(plannedTransaction)
    .set(updateData)
    .where(eq(plannedTransaction.id, id))
    .returning()

  return result[0]
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
