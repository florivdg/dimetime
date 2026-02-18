import { db } from '@/db/database'
import {
  bankTransaction,
  importSource,
  plan,
  plannedTransaction,
  transactionReconciliation,
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
  or,
} from 'drizzle-orm'

export type ImportSource = typeof importSource.$inferSelect
export type NewImportSource = typeof importSource.$inferInsert
export type BankTransaction = typeof bankTransaction.$inferSelect
export type TransactionReconciliation =
  typeof transactionReconciliation.$inferSelect

export interface CreateImportSourceInput {
  name: string
  preset: 'ing_csv_v1' | 'easybank_xlsx_v1'
  sourceKind: 'bank_account' | 'credit_card' | 'other'
  bankName?: string | null
  accountLabel?: string | null
  accountIdentifier?: string | null
  defaultPlanAssignment?: 'auto_month' | 'none'
  isActive?: boolean
}

export interface UpdateImportSourceInput {
  name?: string
  preset?: 'ing_csv_v1' | 'easybank_xlsx_v1'
  sourceKind?: 'bank_account' | 'credit_card' | 'other'
  bankName?: string | null
  accountLabel?: string | null
  accountIdentifier?: string | null
  defaultPlanAssignment?: 'auto_month' | 'none'
  isActive?: boolean
}

export interface BankTransactionQueryOptions {
  sourceId?: string
  planId?: string
  status?: 'booked' | 'pending' | 'unknown'
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: 'bookingDate' | 'amountCents' | 'createdAt'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export type BankTransactionWithRelations = BankTransaction & {
  sourceName: string | null
  planDate: string | null
  planName: string | null
}

export interface PaginatedBankTransactions {
  transactions: BankTransactionWithRelations[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function getImportSources(): Promise<ImportSource[]> {
  return db.query.importSource.findMany({
    orderBy: [desc(importSource.createdAt)],
  })
}

export async function getImportSourceById(
  id: string,
): Promise<ImportSource | undefined> {
  return db.query.importSource.findFirst({
    where: eq(importSource.id, id),
  })
}

export async function createImportSource(
  input: CreateImportSourceInput,
): Promise<ImportSource> {
  const now = new Date()
  const [created] = await db
    .insert(importSource)
    .values({
      name: input.name,
      preset: input.preset,
      sourceKind: input.sourceKind,
      bankName: input.bankName ?? null,
      accountLabel: input.accountLabel ?? null,
      accountIdentifier: input.accountIdentifier ?? null,
      defaultPlanAssignment: input.defaultPlanAssignment ?? 'auto_month',
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return created
}

export async function updateImportSource(
  id: string,
  input: UpdateImportSourceInput,
): Promise<ImportSource | undefined> {
  const updateData: Partial<NewImportSource> = {
    updatedAt: new Date(),
  }

  if (input.name !== undefined) updateData.name = input.name
  if (input.preset !== undefined) updateData.preset = input.preset
  if (input.sourceKind !== undefined) updateData.sourceKind = input.sourceKind
  if (input.bankName !== undefined) updateData.bankName = input.bankName
  if (input.accountLabel !== undefined)
    updateData.accountLabel = input.accountLabel
  if (input.accountIdentifier !== undefined) {
    updateData.accountIdentifier = input.accountIdentifier
  }
  if (input.defaultPlanAssignment !== undefined) {
    updateData.defaultPlanAssignment = input.defaultPlanAssignment
  }
  if (input.isActive !== undefined) updateData.isActive = input.isActive

  const [updated] = await db
    .update(importSource)
    .set(updateData)
    .where(eq(importSource.id, id))
    .returning()

  return updated
}

export async function deleteImportSource(
  id: string,
): Promise<{ deleted: boolean; error?: string }> {
  // Check if any transactions reference this source
  const txCount = await db
    .select({ count: count() })
    .from(bankTransaction)
    .where(eq(bankTransaction.sourceId, id))
  const total = txCount[0]?.count ?? 0
  if (total > 0) {
    return {
      deleted: false,
      error: `Import-Quelle hat ${total} verknüpfte Transaktionen und kann nicht gelöscht werden.`,
    }
  }

  const result = await db
    .delete(importSource)
    .where(eq(importSource.id, id))
    .returning({ id: importSource.id })
  return { deleted: result.length > 0 }
}

export async function getBankTransactions(
  options: BankTransactionQueryOptions = {},
): Promise<PaginatedBankTransactions> {
  const {
    sourceId,
    planId,
    status,
    search,
    dateFrom,
    dateTo,
    sortBy = 'bookingDate',
    sortDir = 'desc',
    page = 1,
    limit = 20,
  } = options

  const conditions = []
  if (sourceId) conditions.push(eq(bankTransaction.sourceId, sourceId))
  if (planId) conditions.push(eq(bankTransaction.planId, planId))
  if (status) conditions.push(eq(bankTransaction.status, status))
  if (dateFrom) conditions.push(gte(bankTransaction.bookingDate, dateFrom))
  if (dateTo) conditions.push(lte(bankTransaction.bookingDate, dateTo))
  if (search) {
    conditions.push(
      or(
        like(bankTransaction.description, `%${search}%`),
        like(bankTransaction.counterparty, `%${search}%`),
        like(bankTransaction.purpose, `%${search}%`),
        like(bankTransaction.bookingText, `%${search}%`),
      ),
    )
  }

  const whereClause =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions)

  const sortColumn =
    sortBy === 'amountCents'
      ? bankTransaction.amountCents
      : sortBy === 'createdAt'
        ? bankTransaction.createdAt
        : bankTransaction.bookingDate
  const orderBy = sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn)

  const countRows = await db
    .select({ count: count() })
    .from(bankTransaction)
    .where(whereClause)
  const total = countRows[0]?.count ?? 0
  const totalPages = limit === -1 ? 1 : Math.ceil(total / limit)

  const query = db
    .select({
      ...getTableColumns(bankTransaction),
      sourceName: importSource.name,
      planDate: plan.date,
      planName: plan.name,
    })
    .from(bankTransaction)
    .leftJoin(importSource, eq(bankTransaction.sourceId, importSource.id))
    .leftJoin(plan, eq(bankTransaction.planId, plan.id))
    .where(whereClause)
    .orderBy(orderBy)

  const transactions =
    limit === -1
      ? await query
      : await query.limit(limit).offset((page - 1) * limit)

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  }
}

export async function getBankTransactionById(
  id: string,
): Promise<BankTransaction | undefined> {
  return db.query.bankTransaction.findFirst({
    where: eq(bankTransaction.id, id),
  })
}

export async function updateBankTransactionPlan(
  id: string,
  planId: string | null,
): Promise<BankTransaction | undefined> {
  const [updated] = await db
    .update(bankTransaction)
    .set({
      planId,
      planAssignment: planId ? 'manual' : 'none',
      updatedAt: new Date(),
    })
    .where(eq(bankTransaction.id, id))
    .returning()

  return updated
}

export async function createManualReconciliation(input: {
  bankTransactionId: string
  plannedTransactionId: string
  matchedByUserId?: string | null
}): Promise<TransactionReconciliation> {
  const [created] = await db
    .insert(transactionReconciliation)
    .values({
      bankTransactionId: input.bankTransactionId,
      plannedTransactionId: input.plannedTransactionId,
      matchType: 'manual',
      confidence: null,
      matchedAt: new Date(),
      matchedByUserId: input.matchedByUserId ?? null,
    })
    .returning()

  return created
}

export async function getReconciliationByBankTransactionId(
  bankTransactionId: string,
): Promise<TransactionReconciliation | undefined> {
  return db.query.transactionReconciliation.findFirst({
    where: eq(transactionReconciliation.bankTransactionId, bankTransactionId),
  })
}

export async function getReconciliationByPlannedTransactionId(
  plannedTransactionId: string,
): Promise<TransactionReconciliation | undefined> {
  return db.query.transactionReconciliation.findFirst({
    where: eq(
      transactionReconciliation.plannedTransactionId,
      plannedTransactionId,
    ),
  })
}

export async function getPlannedTransactionById(
  id: string,
): Promise<typeof plannedTransaction.$inferSelect | undefined> {
  return db.query.plannedTransaction.findFirst({
    where: eq(plannedTransaction.id, id),
  })
}
