import { db } from '@/db/database'
import {
  bankTransaction,
  kassensturzDismissal,
  kassensturzManualEntry,
  plannedTransaction,
  transactionReconciliation,
  category,
} from '@/db/schema/plans'
import { eq, desc, inArray } from 'drizzle-orm'

// Types
export type KassensturzDismissal = typeof kassensturzDismissal.$inferSelect
export type KassensturzManualEntry = typeof kassensturzManualEntry.$inferSelect

export type PlannedItemStatus =
  | 'offen'
  | 'teilweise'
  | 'erfuellt'
  | 'ueberzogen'

export interface KassensturzBankTransaction {
  id: string
  bookingDate: string
  amountCents: number
  counterparty: string | null
  description: string | null
  purpose: string | null
  bookingText: string | null
  sourceName: string | null
}

export interface KassensturzReconciliation {
  id: string
  bankTransactionId: string
  matchType: 'manual' | 'auto'
  matchedAt: Date
  bankTransaction: KassensturzBankTransaction
}

export interface KassensturzPlannedItem {
  id: string
  name: string
  note: string | null
  type: 'income' | 'expense'
  amount: number
  dueDate: string
  isDone: boolean
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  reconciliations: KassensturzReconciliation[]
  manualEntries: KassensturzManualEntry[]
  matchedAmountCents: number
  remainingCents: number
  status: PlannedItemStatus
}

export interface KassensturzDismissedTransaction {
  id: string // dismissal id
  reason: string | null
  dismissedAt: Date
  bankTransaction: KassensturzBankTransaction
}

export interface KassensturzSummary {
  plannedIncome: number
  plannedExpense: number
  plannedNet: number
  actualIncome: number
  actualExpense: number
  actualNet: number
}

export interface KassensturzData {
  summary: KassensturzSummary
  plannedItems: KassensturzPlannedItem[]
  unmatchedBankTransactions: KassensturzBankTransaction[]
  dismissals: KassensturzDismissedTransaction[]
  manualEntries: KassensturzManualEntry[]
}

export async function getKassensturzData(
  planId: string,
): Promise<KassensturzData> {
  // Load all data in parallel
  const [
    plannedTxs,
    allBankTxs,
    allReconciliations,
    allDismissals,
    allManualEntries,
  ] = await Promise.all([
    db
      .select({
        id: plannedTransaction.id,
        name: plannedTransaction.name,
        note: plannedTransaction.note,
        type: plannedTransaction.type,
        amount: plannedTransaction.amount,
        dueDate: plannedTransaction.dueDate,
        isDone: plannedTransaction.isDone,
        categoryId: plannedTransaction.categoryId,
        categoryName: category.name,
        categoryColor: category.color,
      })
      .from(plannedTransaction)
      .leftJoin(category, eq(plannedTransaction.categoryId, category.id))
      .where(eq(plannedTransaction.planId, planId)),
    db
      .select()
      .from(bankTransaction)
      .where(eq(bankTransaction.planId, planId))
      .orderBy(desc(bankTransaction.bookingDate)),
    db
      .select()
      .from(transactionReconciliation)
      .where(
        inArray(
          transactionReconciliation.bankTransactionId,
          db
            .select({ id: bankTransaction.id })
            .from(bankTransaction)
            .where(eq(bankTransaction.planId, planId)),
        ),
      ),
    db
      .select()
      .from(kassensturzDismissal)
      .where(eq(kassensturzDismissal.planId, planId)),
    db
      .select()
      .from(kassensturzManualEntry)
      .where(eq(kassensturzManualEntry.planId, planId)),
  ])

  // Build bank transaction lookup
  const bankTxMap = new Map(allBankTxs.map((tx) => [tx.id, tx]))

  // Build reconciliation lookup by planned transaction id
  const reconciliationsByPlannedId = new Map<
    string,
    (typeof allReconciliations)[number][]
  >()
  // Track which bank transactions are reconciled (to ANY planned tx in this plan's context)
  const reconciledBankTxIds = new Set<string>()

  for (const rec of allReconciliations) {
    reconciledBankTxIds.add(rec.bankTransactionId)

    const existing = reconciliationsByPlannedId.get(rec.plannedTransactionId)
    if (existing) {
      existing.push(rec)
    } else {
      reconciliationsByPlannedId.set(rec.plannedTransactionId, [rec])
    }
  }

  // Build dismissed bank tx set
  const dismissedBankTxIds = new Set(
    allDismissals.map((d) => d.bankTransactionId),
  )

  // Manual entries by planned transaction id
  const manualEntriesByPlannedId = new Map<string, KassensturzManualEntry[]>()
  for (const entry of allManualEntries) {
    if (!entry.plannedTransactionId) continue
    const existing = manualEntriesByPlannedId.get(entry.plannedTransactionId)
    if (existing) {
      existing.push(entry)
    } else {
      manualEntriesByPlannedId.set(entry.plannedTransactionId, [entry])
    }
  }

  // Helper to build bank tx response object
  function toBankTx(
    tx: (typeof allBankTxs)[number],
  ): KassensturzBankTransaction {
    return {
      id: tx.id,
      bookingDate: tx.bookingDate,
      amountCents: tx.amountCents,
      counterparty: tx.counterparty,
      description: tx.description,
      purpose: tx.purpose,
      bookingText: tx.bookingText,
      sourceName: null, // not joined here for performance
    }
  }

  // Build planned items
  const plannedItems: KassensturzPlannedItem[] = plannedTxs.map((pt) => {
    const recs = reconciliationsByPlannedId.get(pt.id) ?? []
    const manualEntries = manualEntriesByPlannedId.get(pt.id) ?? []

    const reconciliationsWithBankTx: KassensturzReconciliation[] = recs.reduce<
      KassensturzReconciliation[]
    >((acc, rec) => {
      const btx = bankTxMap.get(rec.bankTransactionId)
      if (btx) {
        acc.push({
          id: rec.id,
          bankTransactionId: rec.bankTransactionId,
          matchType: rec.matchType,
          matchedAt: rec.matchedAt,
          bankTransaction: toBankTx(btx),
        })
      }
      return acc
    }, [])

    // Matched amount = sum of reconciled bank transactions + manual entries assigned to this item
    const reconciledCents = reconciliationsWithBankTx.reduce(
      (sum, r) => sum + Math.abs(r.bankTransaction.amountCents),
      0,
    )
    const manualCents = manualEntries.reduce(
      (sum, e) => sum + Math.abs(e.amountCents),
      0,
    )
    const matchedAmountCents = reconciledCents + manualCents
    const plannedCents = Math.abs(pt.amount)
    const remainingCents = Math.max(0, plannedCents - matchedAmountCents)

    let status: PlannedItemStatus = 'offen'
    if (matchedAmountCents === 0) {
      status = 'offen'
    } else if (matchedAmountCents < plannedCents) {
      status = 'teilweise'
    } else if (matchedAmountCents === plannedCents) {
      status = 'erfuellt'
    } else {
      status = 'ueberzogen'
    }

    return {
      id: pt.id,
      name: pt.name,
      note: pt.note,
      type: pt.type,
      amount: pt.amount,
      dueDate: pt.dueDate,
      isDone: pt.isDone,
      categoryId: pt.categoryId,
      categoryName: pt.categoryName,
      categoryColor: pt.categoryColor,
      reconciliations: reconciliationsWithBankTx,
      manualEntries,
      matchedAmountCents,
      remainingCents,
      status,
    }
  })

  // Unmatched bank transactions: not reconciled and not dismissed
  const unmatchedBankTransactions = allBankTxs
    .filter(
      (tx) => !reconciledBankTxIds.has(tx.id) && !dismissedBankTxIds.has(tx.id),
    )
    .map(toBankTx)

  // Dismissed transactions with bank tx details
  const dismissals: KassensturzDismissedTransaction[] = allDismissals
    .map((d) => {
      const btx = bankTxMap.get(d.bankTransactionId)
      if (!btx) return null
      return {
        id: d.id,
        reason: d.reason,
        dismissedAt: d.dismissedAt,
        bankTransaction: toBankTx(btx),
      }
    })
    .filter((d): d is KassensturzDismissedTransaction => d !== null)

  // Summary calculations
  const plannedIncome = plannedTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const plannedExpense = plannedTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  // Actual: from non-dismissed bank transactions + manual entries
  const nonDismissedBankTxs = allBankTxs.filter(
    (tx) => !dismissedBankTxIds.has(tx.id),
  )
  const actualIncome =
    nonDismissedBankTxs
      .filter((tx) => tx.amountCents > 0)
      .reduce((sum, tx) => sum + tx.amountCents, 0) +
    allManualEntries
      .filter((e) => e.type === 'income')
      .reduce((sum, e) => sum + Math.abs(e.amountCents), 0)
  const actualExpense =
    nonDismissedBankTxs
      .filter((tx) => tx.amountCents < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0) +
    allManualEntries
      .filter((e) => e.type === 'expense')
      .reduce((sum, e) => sum + Math.abs(e.amountCents), 0)

  return {
    summary: {
      plannedIncome,
      plannedExpense,
      plannedNet: plannedIncome - plannedExpense,
      actualIncome,
      actualExpense,
      actualNet: actualIncome - actualExpense,
    },
    plannedItems,
    unmatchedBankTransactions,
    dismissals,
    manualEntries: allManualEntries,
  }
}

export async function removeReconciliation(reconciliationId: string) {
  const [deleted] = await db
    .delete(transactionReconciliation)
    .where(eq(transactionReconciliation.id, reconciliationId))
    .returning()

  return deleted
}

// Dismissals
export async function dismissBankTransaction(input: {
  bankTransactionId: string
  planId: string
  reason?: string | null
  userId?: string | null
}) {
  const [created] = await db
    .insert(kassensturzDismissal)
    .values({
      bankTransactionId: input.bankTransactionId,
      planId: input.planId,
      reason: input.reason ?? null,
      dismissedAt: new Date(),
      dismissedByUserId: input.userId ?? null,
    })
    .returning()

  return created
}

export async function undismissBankTransaction(dismissalId: string) {
  const [deleted] = await db
    .delete(kassensturzDismissal)
    .where(eq(kassensturzDismissal.id, dismissalId))
    .returning()

  return deleted
}

// Manual entries
export async function createManualEntry(input: {
  planId: string
  name: string
  note?: string | null
  amountCents: number
  type: 'income' | 'expense'
  plannedTransactionId?: string | null
  userId?: string | null
}) {
  const now = new Date()
  const [created] = await db
    .insert(kassensturzManualEntry)
    .values({
      planId: input.planId,
      name: input.name,
      note: input.note ?? null,
      amountCents: input.amountCents,
      type: input.type,
      plannedTransactionId: input.plannedTransactionId ?? null,
      createdByUserId: input.userId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return created
}

export async function updateManualEntry(
  id: string,
  input: {
    name?: string
    note?: string | null
    amountCents?: number
    type?: 'income' | 'expense'
    plannedTransactionId?: string | null
  },
) {
  const updateData: Record<string, unknown> = {}

  if (input.name !== undefined) updateData.name = input.name
  if (input.note !== undefined) updateData.note = input.note
  if (input.amountCents !== undefined)
    updateData.amountCents = input.amountCents
  if (input.type !== undefined) updateData.type = input.type
  if (input.plannedTransactionId !== undefined) {
    updateData.plannedTransactionId = input.plannedTransactionId
  }

  const [updated] = await db
    .update(kassensturzManualEntry)
    .set(updateData)
    .where(eq(kassensturzManualEntry.id, id))
    .returning()

  return updated
}

export async function deleteManualEntry(id: string) {
  const [deleted] = await db
    .delete(kassensturzManualEntry)
    .where(eq(kassensturzManualEntry.id, id))
    .returning()

  return deleted
}
