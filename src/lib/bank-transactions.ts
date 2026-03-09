import { db } from '@/db/database'
import {
  bankTransaction,
  bankTransactionSplit,
  importSource,
  plan,
  plannedTransaction,
} from '@/db/schema/plans'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { unionAll } from 'drizzle-orm/sqlite-core'

export type ImportSource = typeof importSource.$inferSelect
export type NewImportSource = typeof importSource.$inferInsert
export type BankTransaction = typeof bankTransaction.$inferSelect

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
  showArchived?: boolean
  sortBy?: 'bookingDate' | 'amountCents' | 'createdAt'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export type BankTransactionWithRelations = BankTransaction & {
  sourceName: string | null
  planDate: string | null
  planName: string | null
  budgetName: string | null
}

export interface BankTransactionRow {
  id: string
  rowType: 'transaction' | 'split'
  parentId: string | null
  bookingDate: string
  counterparty: string | null
  description: string | null
  amountCents: number
  label: string | null
  sourceName: string | null
  status: string
  planId: string | null
  planDate: string | null
  planName: string | null
  budgetId: string | null
  budgetName: string | null
  isArchived: boolean
  note: string | null
  isSplit: boolean
  createdAt: Date
  sortOrder: number
}

export interface PaginatedBankTransactions {
  rows: BankTransactionRow[]
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

  // Base conditions applied to the parent bankTransaction in both branches
  const parentConditions = []
  if (sourceId) parentConditions.push(eq(bankTransaction.sourceId, sourceId))
  if (status) parentConditions.push(eq(bankTransaction.status, status))
  if (dateFrom)
    parentConditions.push(gte(bankTransaction.bookingDate, dateFrom))
  if (dateTo) parentConditions.push(lte(bankTransaction.bookingDate, dateTo))
  if (!options.showArchived) {
    parentConditions.push(eq(bankTransaction.isArchived, false))
  }
  const parentSearchCondition = search
    ? or(
        like(bankTransaction.description, `%${search}%`),
        like(bankTransaction.counterparty, `%${search}%`),
        like(bankTransaction.purpose, `%${search}%`),
        like(bankTransaction.bookingText, `%${search}%`),
      )
    : undefined

  // Branch 1: regular (non-split) transactions
  const txConditions = [...parentConditions, eq(bankTransaction.isSplit, false)]
  if (parentSearchCondition) txConditions.push(parentSearchCondition)
  if (planId) txConditions.push(eq(bankTransaction.planId, planId))
  const txWhere = and(...txConditions)

  const txBranch = db
    .select({
      id: bankTransaction.id,
      rowType: sql<string>`'transaction'`.as('row_type'),
      parentId: sql<string | null>`null`.as('parent_id'),
      bookingDate: bankTransaction.bookingDate,
      counterparty: bankTransaction.counterparty,
      description: bankTransaction.description,
      amountCents: bankTransaction.amountCents,
      label: sql<string | null>`null`.as('label'),
      sourceName: importSource.name,
      status: bankTransaction.status,
      planId: bankTransaction.planId,
      planDate: plan.date,
      planName: plan.name,
      budgetId: bankTransaction.budgetId,
      budgetName: plannedTransaction.name,
      isArchived: bankTransaction.isArchived,
      note: bankTransaction.note,
      isSplit: bankTransaction.isSplit,
      createdAt: bankTransaction.createdAt,
      sortOrder: sql<number>`0`.as('sort_order'),
      sortGroup: sql`${bankTransaction.id}`.as('sort_group'),
    })
    .from(bankTransaction)
    .leftJoin(importSource, eq(bankTransaction.sourceId, importSource.id))
    .leftJoin(plan, eq(bankTransaction.planId, plan.id))
    .leftJoin(
      plannedTransaction,
      eq(bankTransaction.budgetId, plannedTransaction.id),
    )
    .where(txWhere)

  // Branch 2: split children (joined to their parent bankTransaction)
  const splitParentConditions = [
    ...parentConditions,
    eq(bankTransaction.isSplit, true),
  ]
  if (parentSearchCondition || search) {
    splitParentConditions.push(
      or(
        parentSearchCondition,
        like(bankTransactionSplit.label, `%${search}%`),
      )!,
    )
  }
  if (planId)
    splitParentConditions.push(eq(bankTransactionSplit.planId, planId))
  const splitWhere = and(...splitParentConditions)

  const splitBranch = db
    .select({
      id: bankTransactionSplit.id,
      rowType: sql<string>`'split'`.as('row_type'),
      parentId: bankTransactionSplit.bankTransactionId,
      bookingDate: bankTransaction.bookingDate,
      counterparty: bankTransaction.counterparty,
      description: bankTransaction.description,
      amountCents: bankTransactionSplit.amountCents,
      label: bankTransactionSplit.label,
      sourceName: importSource.name,
      status: bankTransaction.status,
      planId: bankTransactionSplit.planId,
      planDate: plan.date,
      planName: plan.name,
      budgetId: bankTransactionSplit.budgetId,
      budgetName: plannedTransaction.name,
      isArchived: bankTransaction.isArchived,
      note: sql<string | null>`null`.as('note'),
      isSplit: sql<boolean>`0`.as('is_split'),
      createdAt: bankTransactionSplit.createdAt,
      sortOrder: bankTransactionSplit.sortOrder,
      sortGroup: sql`${bankTransactionSplit.bankTransactionId}`.as(
        'sort_group',
      ),
    })
    .from(bankTransactionSplit)
    .innerJoin(
      bankTransaction,
      eq(bankTransactionSplit.bankTransactionId, bankTransaction.id),
    )
    .leftJoin(importSource, eq(bankTransaction.sourceId, importSource.id))
    .leftJoin(plan, eq(bankTransactionSplit.planId, plan.id))
    .leftJoin(
      plannedTransaction,
      eq(bankTransactionSplit.budgetId, plannedTransaction.id),
    )
    .where(splitWhere)

  // Count: sum both branches separately
  const [txCountResult, splitCountResult] = await Promise.all([
    db.select({ count: count() }).from(bankTransaction).where(txWhere),
    db
      .select({ count: count() })
      .from(bankTransactionSplit)
      .innerJoin(
        bankTransaction,
        eq(bankTransactionSplit.bankTransactionId, bankTransaction.id),
      )
      .where(splitWhere),
  ])
  const total =
    (txCountResult[0]?.count ?? 0) + (splitCountResult[0]?.count ?? 0)
  const totalPages = limit === -1 ? 1 : Math.ceil(total / limit)

  // Sort column for the combined result
  const sortColumn =
    sortBy === 'amountCents'
      ? sql`amount_cents`
      : sortBy === 'createdAt'
        ? sql`created_at`
        : sql`booking_date`
  const dirFn = sortDir === 'asc' ? asc : desc

  // Combined UNION ALL query with ordering and pagination
  const combined = unionAll(txBranch, splitBranch).orderBy(
    dirFn(sortColumn),
    sql`sort_group`,
    asc(sql`sort_order`),
  )

  const rows =
    limit === -1
      ? await combined
      : await combined.limit(limit).offset((page - 1) * limit)

  return {
    rows: rows as BankTransactionRow[],
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

export async function updateBankTransactionNote(
  id: string,
  note: string | null,
): Promise<BankTransaction | undefined> {
  const [updated] = await db
    .update(bankTransaction)
    .set({
      note,
      updatedAt: new Date(),
    })
    .where(eq(bankTransaction.id, id))
    .returning()

  return updated
}

export async function updateBankTransactionFields(
  id: string,
  fields: {
    planId?: string | null
    note?: string | null
    budgetId?: string | null
  },
): Promise<BankTransaction | undefined> {
  const setValues: Partial<typeof bankTransaction.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (fields.planId !== undefined) {
    setValues.planId = fields.planId
    setValues.planAssignment = fields.planId ? 'manual' : 'none'
    // Clear budget when plan changes (budget is plan-specific)
    setValues.budgetId = null
  }

  if (fields.budgetId !== undefined) {
    setValues.budgetId = fields.budgetId
  }

  if (fields.note !== undefined) {
    setValues.note = fields.note
  }

  const [updated] = await db
    .update(bankTransaction)
    .set(setValues)
    .where(eq(bankTransaction.id, id))
    .returning()

  return updated
}

export async function bulkArchiveBankTransactions(
  ids: string[],
  isArchived: boolean,
): Promise<number> {
  const result = await db
    .update(bankTransaction)
    .set({ isArchived, updatedAt: new Date() })
    .where(inArray(bankTransaction.id, ids))
    .returning({ id: bankTransaction.id })
  return result.length
}

export async function bulkAssignPlanToTransactions(
  ids: string[],
  planId: string | null,
): Promise<number> {
  const now = new Date()

  return db.transaction(async (tx) => {
    const targetTransactions = await tx
      .select({
        id: bankTransaction.id,
        planId: bankTransaction.planId,
      })
      .from(bankTransaction)
      .where(inArray(bankTransaction.id, ids))

    if (targetTransactions.length === 0) {
      return 0
    }

    const idsToClearBudget = targetTransactions
      .filter((transaction) => planId === null || transaction.planId !== planId)
      .map((transaction) => transaction.id)
    const idsToKeepBudget = targetTransactions
      .filter((transaction) => planId !== null && transaction.planId === planId)
      .map((transaction) => transaction.id)

    if (idsToClearBudget.length > 0) {
      await tx
        .update(bankTransaction)
        .set({
          planId,
          planAssignment: planId ? 'manual' : 'none',
          budgetId: null,
          updatedAt: now,
        })
        .where(inArray(bankTransaction.id, idsToClearBudget))
    }

    if (idsToKeepBudget.length > 0) {
      await tx
        .update(bankTransaction)
        .set({
          planId,
          planAssignment: planId ? 'manual' : 'none',
          updatedAt: now,
        })
        .where(inArray(bankTransaction.id, idsToKeepBudget))
    }

    return targetTransactions.length
  })
}

export async function bulkAssignBudgetToTransactions(
  ids: string[],
  budgetId: string | null,
): Promise<number> {
  const result = await db
    .update(bankTransaction)
    .set({
      budgetId,
      updatedAt: new Date(),
    })
    .where(inArray(bankTransaction.id, ids))
    .returning({ id: bankTransaction.id })
  return result.length
}
