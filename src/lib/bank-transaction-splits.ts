import { db, type DbOrTransaction } from '@/db/database'
import {
  bankTransaction,
  bankTransactionSplit,
  plan,
  plannedTransaction,
} from '@/db/schema/plans'
import { and, eq, inArray, sum } from 'drizzle-orm'

export type BankTransactionSplit = typeof bankTransactionSplit.$inferSelect

export interface SplitWithBudget extends BankTransactionSplit {
  budgetName: string | null
  planDate: string | null
  planName: string | null
}

export interface SplitParentInfo {
  id: string
  bookingDate: string
  counterparty: string | null
  description: string | null
  sourceName: string | null
  status: string
  planId: string | null
  planDate: string | null
  planName: string | null
  isArchived: boolean
}

export interface SplitGroup {
  parentId: string
  parent: SplitParentInfo
  children: SplitWithBudget[]
}

function assertValidSplitAmounts(
  parentAmountCents: number,
  splits: { amountCents: number; label?: string }[],
) {
  if (parentAmountCents === 0) {
    throw new Error('Transaktionen mit 0,00 EUR können nicht aufgeteilt werden')
  }

  const expectedSign = Math.sign(parentAmountCents)
  for (const split of splits) {
    if (!Number.isInteger(split.amountCents) || split.amountCents === 0) {
      throw new Error(
        'Jeder Teilbetrag muss ein von 0 verschiedener Cent-Betrag sein',
      )
    }
    if (Math.sign(split.amountCents) !== expectedSign) {
      throw new Error(
        'Alle Teilbeträge müssen dasselbe Vorzeichen wie die Originaltransaktion haben',
      )
    }
  }

  const splitSum = splits.reduce((acc, s) => acc + s.amountCents, 0)
  if (splitSum !== parentAmountCents) {
    throw new Error(
      `Summe der Teile (${splitSum}) stimmt nicht mit dem Originalbetrag (${parentAmountCents}) überein`,
    )
  }
}

export async function splitBankTransaction(
  id: string,
  splits: { amountCents: number; label?: string }[],
): Promise<BankTransactionSplit[]> {
  const parent = await db.query.bankTransaction.findFirst({
    where: eq(bankTransaction.id, id),
  })

  if (!parent) throw new Error('Banktransaktion nicht gefunden')
  if (parent.isSplit) throw new Error('Transaktion ist bereits aufgeteilt')
  if (splits.length < 2)
    throw new Error('Mindestens zwei Teile sind erforderlich')
  assertValidSplitAmounts(parent.amountCents, splits)

  const now = new Date()

  return db.transaction(async (tx) => {
    await tx
      .update(bankTransaction)
      .set({
        isSplit: true,
        preSplitBudgetId: parent.budgetId,
        budgetId: null,
        updatedAt: now,
      })
      .where(eq(bankTransaction.id, id))

    const rows = splits.map((s, i) => ({
      bankTransactionId: id,
      amountCents: s.amountCents,
      label: s.label ?? null,
      planId: parent.planId,
      sortOrder: i,
      createdAt: now,
      updatedAt: now,
    }))

    return tx.insert(bankTransactionSplit).values(rows).returning()
  })
}

export async function unsplitBankTransaction(id: string): Promise<void> {
  const parent = await db.query.bankTransaction.findFirst({
    where: eq(bankTransaction.id, id),
  })

  if (!parent) throw new Error('Banktransaktion nicht gefunden')
  if (!parent.isSplit) throw new Error('Transaktion ist nicht aufgeteilt')

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .delete(bankTransactionSplit)
      .where(eq(bankTransactionSplit.bankTransactionId, id))

    await tx
      .update(bankTransaction)
      .set({
        isSplit: false,
        budgetId: parent.preSplitBudgetId,
        preSplitBudgetId: null,
        updatedAt: now,
      })
      .where(eq(bankTransaction.id, id))
  })
}

export async function getSplitById(
  splitId: string,
): Promise<BankTransactionSplit | undefined> {
  return db.query.bankTransactionSplit.findFirst({
    where: eq(bankTransactionSplit.id, splitId),
  })
}

export async function getSplitsForTransactionIds(
  ids: string[],
  parentInfoMap?: Map<string, SplitParentInfo>,
): Promise<SplitGroup[]> {
  if (ids.length === 0) return []

  const rows = await db
    .select({
      id: bankTransactionSplit.id,
      bankTransactionId: bankTransactionSplit.bankTransactionId,
      amountCents: bankTransactionSplit.amountCents,
      label: bankTransactionSplit.label,
      budgetId: bankTransactionSplit.budgetId,
      planId: bankTransactionSplit.planId,
      sortOrder: bankTransactionSplit.sortOrder,
      isArchived: bankTransactionSplit.isArchived,
      createdAt: bankTransactionSplit.createdAt,
      updatedAt: bankTransactionSplit.updatedAt,
      budgetName: plannedTransaction.name,
      planDate: plan.date,
      planName: plan.name,
    })
    .from(bankTransactionSplit)
    .leftJoin(
      plannedTransaction,
      eq(bankTransactionSplit.budgetId, plannedTransaction.id),
    )
    .leftJoin(plan, eq(bankTransactionSplit.planId, plan.id))
    .where(inArray(bankTransactionSplit.bankTransactionId, ids))
    .orderBy(bankTransactionSplit.sortOrder)

  const grouped = new Map<string, SplitWithBudget[]>()
  for (const row of rows) {
    const parentId = row.bankTransactionId
    if (!grouped.has(parentId)) grouped.set(parentId, [])
    grouped.get(parentId)!.push({
      ...row,
      budgetName: row.budgetName ?? null,
      planDate: row.planDate ?? null,
      planName: row.planName ?? null,
    })
  }

  return Array.from(grouped.entries())
    .filter(([parentId]) => !parentInfoMap || parentInfoMap.has(parentId))
    .map(([parentId, children]) => ({
      parentId,
      parent: parentInfoMap?.get(parentId) ?? {
        id: parentId,
        bookingDate: '',
        counterparty: null,
        description: null,
        sourceName: null,
        status: 'unknown',
        planId: null,
        planDate: null,
        planName: null,
        isArchived: false,
      },
      children,
    }))
}

function buildSpendingRecord(
  rows: { budgetId: string | null; spent: string | number | null }[],
): Record<string, number> {
  const spending: Record<string, number> = {}
  for (const row of rows) {
    if (row.budgetId) {
      spending[row.budgetId] = Math.abs(Number(row.spent) || 0)
    }
  }
  return spending
}

export async function getBudgetSpendingFromSplits(
  budgetIds: string[],
): Promise<Record<string, number>> {
  if (budgetIds.length === 0) return {}

  const result = await db
    .select({
      budgetId: bankTransactionSplit.budgetId,
      spent: sum(bankTransactionSplit.amountCents),
    })
    .from(bankTransactionSplit)
    .where(inArray(bankTransactionSplit.budgetId, budgetIds))
    .groupBy(bankTransactionSplit.budgetId)

  return buildSpendingRecord(result)
}

export async function updateSplitFields(
  splitId: string,
  fields: { planId?: string | null; budgetId?: string | null },
): Promise<BankTransactionSplit | undefined> {
  const setValues: Partial<typeof bankTransactionSplit.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (fields.planId !== undefined) {
    setValues.planId = fields.planId
    // Clear budget when plan changes (budget is plan-specific)
    setValues.budgetId = null
  }

  if (fields.budgetId !== undefined) {
    setValues.budgetId = fields.budgetId
  }

  const [updated] = await db
    .update(bankTransactionSplit)
    .set(setValues)
    .where(eq(bankTransactionSplit.id, splitId))
    .returning()

  return updated
}

export async function bulkAssignPlanToSplits(
  ids: string[],
  planId: string | null,
  txOrDb: DbOrTransaction = db,
): Promise<number> {
  if (ids.length === 0) return 0
  const now = new Date()

  const targetSplits = await txOrDb
    .select({
      id: bankTransactionSplit.id,
      planId: bankTransactionSplit.planId,
    })
    .from(bankTransactionSplit)
    .where(inArray(bankTransactionSplit.id, ids))

  if (targetSplits.length === 0) return 0

  const idsToClearBudget = targetSplits
    .filter((s) => planId === null || s.planId !== planId)
    .map((s) => s.id)
  const idsToKeepBudget = targetSplits
    .filter((s) => planId !== null && s.planId === planId)
    .map((s) => s.id)

  if (idsToClearBudget.length > 0) {
    await txOrDb
      .update(bankTransactionSplit)
      .set({ planId, budgetId: null, updatedAt: now })
      .where(inArray(bankTransactionSplit.id, idsToClearBudget))
  }

  if (idsToKeepBudget.length > 0) {
    await txOrDb
      .update(bankTransactionSplit)
      .set({ planId, updatedAt: now })
      .where(inArray(bankTransactionSplit.id, idsToKeepBudget))
  }

  return targetSplits.length
}

export async function bulkArchiveSplits(
  ids: string[],
  isArchived: boolean,
  txOrDb: DbOrTransaction = db,
): Promise<number> {
  if (ids.length === 0) return 0
  const result = await txOrDb
    .update(bankTransactionSplit)
    .set({ isArchived, updatedAt: new Date() })
    .where(inArray(bankTransactionSplit.id, ids))
    .returning({ id: bankTransactionSplit.id })
  return result.length
}

export async function bulkAssignBudgetToSplits(
  ids: string[],
  budgetId: string | null,
  txOrDb: DbOrTransaction = db,
): Promise<number> {
  if (ids.length === 0) return 0
  const result = await txOrDb
    .update(bankTransactionSplit)
    .set({ budgetId, updatedAt: new Date() })
    .where(inArray(bankTransactionSplit.id, ids))
    .returning({ id: bankTransactionSplit.id })
  return result.length
}

export async function getBudgetSpendingFromSplitsForPlan(
  planId: string,
): Promise<Record<string, number>> {
  const result = await db
    .select({
      budgetId: bankTransactionSplit.budgetId,
      spent: sum(bankTransactionSplit.amountCents),
    })
    .from(bankTransactionSplit)
    .innerJoin(
      plannedTransaction,
      eq(bankTransactionSplit.budgetId, plannedTransaction.id),
    )
    .where(
      and(
        eq(plannedTransaction.planId, planId),
        eq(plannedTransaction.isBudget, true),
      ),
    )
    .groupBy(bankTransactionSplit.budgetId)

  return buildSpendingRecord(result)
}
