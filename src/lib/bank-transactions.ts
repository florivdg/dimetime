import { db, type DbOrTransaction } from '@/db/database'
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
import { buildSetValues } from '@/lib/db/partial-update'

export type ImportSource = typeof importSource.$inferSelect
type NewImportSource = typeof importSource.$inferInsert
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
  purpose: string | null
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
  const updateData = buildSetValues<typeof input, NewImportSource>(input, {
    name: (v, s) => {
      s.name = v
    },
    preset: (v, s) => {
      s.preset = v
    },
    sourceKind: (v, s) => {
      s.sourceKind = v
    },
    bankName: (v, s) => {
      s.bankName = v
    },
    accountLabel: (v, s) => {
      s.accountLabel = v
    },
    accountIdentifier: (v, s) => {
      s.accountIdentifier = v
    },
    defaultPlanAssignment: (v, s) => {
      s.defaultPlanAssignment = v
    },
    isActive: (v, s) => {
      s.isActive = v
    },
  })

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

export async function deleteBankTransaction(id: string): Promise<boolean> {
  const result = await db
    .delete(bankTransaction)
    .where(eq(bankTransaction.id, id))
    .returning({ id: bankTransaction.id })
  return result.length > 0
}

// fallow-ignore-next-line complexity
function buildBankTxParentConditions(options: BankTransactionQueryOptions) {
  const { sourceId, status, dateFrom, dateTo, showArchived } = options
  const parentConditions = []
  if (sourceId) parentConditions.push(eq(bankTransaction.sourceId, sourceId))
  if (status) parentConditions.push(eq(bankTransaction.status, status))
  if (dateFrom)
    parentConditions.push(gte(bankTransaction.bookingDate, dateFrom))
  if (dateTo) parentConditions.push(lte(bankTransaction.bookingDate, dateTo))
  if (!showArchived)
    parentConditions.push(eq(bankTransaction.isArchived, false))
  return parentConditions
}

function buildBankTxSearchCondition(search: string | undefined) {
  if (!search) return undefined
  return or(
    like(bankTransaction.description, `%${search}%`),
    like(bankTransaction.counterparty, `%${search}%`),
    like(bankTransaction.purpose, `%${search}%`),
    like(bankTransaction.bookingText, `%${search}%`),
  )
}

// fallow-ignore-next-line complexity
export async function getBankTransactions(
  options: BankTransactionQueryOptions = {},
): Promise<PaginatedBankTransactions> {
  const {
    planId,
    search,
    sortBy = 'bookingDate',
    sortDir = 'desc',
    page = 1,
    limit = 20,
  } = options

  const parentConditions = buildBankTxParentConditions(options)
  const parentSearchCondition = buildBankTxSearchCondition(search)

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
      purpose: bankTransaction.purpose,
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
  if (!options.showArchived) {
    splitParentConditions.push(eq(bankTransactionSplit.isArchived, false))
  }
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
      isArchived: bankTransactionSplit.isArchived,
      note: bankTransactionSplit.note,
      purpose: bankTransaction.purpose,
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

  // Run count queries and data query in parallel
  const [txCountResult, splitCountResult, rows] = await Promise.all([
    db.select({ count: count() }).from(bankTransaction).where(txWhere),
    db
      .select({ count: count() })
      .from(bankTransactionSplit)
      .innerJoin(
        bankTransaction,
        eq(bankTransactionSplit.bankTransactionId, bankTransaction.id),
      )
      .where(splitWhere),
    limit === -1 ? combined : combined.limit(limit).offset((page - 1) * limit),
  ])
  const total =
    (txCountResult[0]?.count ?? 0) + (splitCountResult[0]?.count ?? 0)
  const totalPages = limit === -1 ? 1 : Math.ceil(total / limit)

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

export interface BankTransactionPatchFields {
  planId?: string | null
  note?: string | null
  budgetId?: string | null
}

/**
 * Validates a partial bank-transaction update against plan/budget rules.
 * Returns null on success or an error tuple to forward as a JSON response.
 */
// fallow-ignore-next-line complexity
export async function validateBankTransactionPatch(
  fields: BankTransactionPatchFields,
  existing: { planId: string | null },
  loadPlan: (id: string) => Promise<{ isArchived: boolean } | undefined | null>,
  loadBudget: (
    id: string,
  ) => Promise<{ isBudget: boolean; planId: string | null } | undefined | null>,
): Promise<{ message: string; status: number } | null> {
  if (fields.planId !== undefined && fields.planId) {
    const targetPlan = await loadPlan(fields.planId)
    if (!targetPlan) return { message: 'Zielplan nicht gefunden', status: 404 }
    if (targetPlan.isArchived) {
      return {
        message:
          'Banktransaktionen können nicht einem archivierten Plan zugeordnet werden.',
        status: 400,
      }
    }
  }

  if (fields.budgetId !== undefined && fields.budgetId !== null) {
    const budget = await loadBudget(fields.budgetId)
    if (!budget) return { message: 'Budget nicht gefunden', status: 404 }
    if (!budget.isBudget) {
      return { message: 'Transaktion ist kein Budget', status: 400 }
    }

    const effectivePlanId =
      fields.planId !== undefined ? fields.planId : existing.planId
    if (budget.planId !== effectivePlanId) {
      return {
        message: 'Budget gehört nicht zum zugewiesenen Plan',
        status: 400,
      }
    }
  }

  return null
}

export async function updateBankTransactionFields(
  id: string,
  fields: {
    planId?: string | null
    note?: string | null
    budgetId?: string | null
  },
): Promise<BankTransaction | undefined> {
  const setValues = buildSetValues<
    typeof fields,
    typeof bankTransaction.$inferInsert
  >(fields, {
    planId: (v, s) => {
      s.planId = v
      s.planAssignment = v ? 'manual' : 'none'
      // Clear budget when plan changes (budget is plan-specific)
      s.budgetId = null
    },
    budgetId: (v, s) => {
      s.budgetId = v
    },
    note: (v, s) => {
      s.note = v
    },
  })

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
  txOrDb: DbOrTransaction = db,
): Promise<number> {
  const result = await txOrDb
    .update(bankTransaction)
    .set({ isArchived, updatedAt: new Date() })
    .where(inArray(bankTransaction.id, ids))
    .returning({ id: bankTransaction.id })
  return result.length
}

export async function bulkAssignPlanToTransactions(
  ids: string[],
  planId: string | null,
  txOrDb: DbOrTransaction = db,
): Promise<number> {
  const now = new Date()

  const targetTransactions = await txOrDb
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
    await txOrDb
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
    await txOrDb
      .update(bankTransaction)
      .set({
        planId,
        planAssignment: planId ? 'manual' : 'none',
        updatedAt: now,
      })
      .where(inArray(bankTransaction.id, idsToKeepBudget))
  }

  return targetTransactions.length
}

export async function bulkAssignBudgetToTransactions(
  ids: string[],
  budgetId: string | null,
  txOrDb: DbOrTransaction = db,
): Promise<number> {
  const result = await txOrDb
    .update(bankTransaction)
    .set({
      budgetId,
      updatedAt: new Date(),
    })
    .where(inArray(bankTransaction.id, ids))
    .returning({ id: bankTransaction.id })
  return result.length
}
