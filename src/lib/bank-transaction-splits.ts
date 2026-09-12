import { db, type DbOrTransaction } from '@/db/database'
import {
  bankTransaction,
  bankTransactionSplit,
  plannedTransaction,
} from '@/db/schema/plans'
import { and, eq, inArray, sum } from 'drizzle-orm'
import { buildSetValues } from '@/lib/db/partial-update'
import { partitionByPlan } from '@/lib/plan-partition'

export type BankTransactionSplit = typeof bankTransactionSplit.$inferSelect

function isValidSplitAmount(amountCents: number): boolean {
  return Number.isInteger(amountCents) && amountCents !== 0
}

function assertSplitMatchesSign(
  splits: { amountCents: number }[],
  expectedSign: number,
) {
  for (const split of splits) {
    if (!isValidSplitAmount(split.amountCents)) {
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
}

function assertValidSplitAmounts(
  parentAmountCents: number,
  splits: { amountCents: number; label?: string }[],
) {
  if (parentAmountCents === 0) {
    throw new Error('Transaktionen mit 0,00 EUR können nicht aufgeteilt werden')
  }

  assertSplitMatchesSign(splits, Math.sign(parentAmountCents))

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

  return db.transaction((tx) => {
    tx.update(bankTransaction)
      .set({
        isSplit: true,
        preSplitBudgetId: parent.budgetId,
        budgetId: null,
        updatedAt: now,
      })
      .where(eq(bankTransaction.id, id))
      .run()

    const rows = splits.map((s, i) => ({
      bankTransactionId: id,
      amountCents: s.amountCents,
      label: s.label ?? null,
      planId: parent.planId,
      sortOrder: i,
      createdAt: now,
      updatedAt: now,
    }))

    return tx.insert(bankTransactionSplit).values(rows).returning().all()
  })
}

export async function unsplitBankTransaction(id: string): Promise<void> {
  const parent = await db.query.bankTransaction.findFirst({
    where: eq(bankTransaction.id, id),
  })

  if (!parent) throw new Error('Banktransaktion nicht gefunden')
  if (!parent.isSplit) throw new Error('Transaktion ist nicht aufgeteilt')

  const now = new Date()

  db.transaction((tx) => {
    tx.delete(bankTransactionSplit)
      .where(eq(bankTransactionSplit.bankTransactionId, id))
      .run()

    tx.update(bankTransaction)
      .set({
        isSplit: false,
        budgetId: parent.preSplitBudgetId,
        preSplitBudgetId: null,
        updatedAt: now,
      })
      .where(eq(bankTransaction.id, id))
      .run()
  })
}

export async function getSplitById(
  splitId: string,
): Promise<BankTransactionSplit | undefined> {
  return db.query.bankTransactionSplit.findFirst({
    where: eq(bankTransactionSplit.id, splitId),
  })
}

export function buildSpendingRecord(
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
  fields: {
    planId?: string | null
    budgetId?: string | null
    note?: string | null
  },
): Promise<BankTransactionSplit | undefined> {
  const setValues = buildSetValues<
    typeof fields,
    typeof bankTransactionSplit.$inferInsert
  >(fields, {
    planId: (v, s) => {
      // fallow-ignore-next-line code-duplication
      s.planId = v
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
    .update(bankTransactionSplit)
    .set(setValues)
    .where(eq(bankTransactionSplit.id, splitId))
    .returning()

  return updated
}

function updateSplitPlanGroup(
  txOrDb: DbOrTransaction,
  ids: string[],
  values: Partial<typeof bankTransactionSplit.$inferInsert>,
) {
  if (ids.length === 0) return
  txOrDb
    .update(bankTransactionSplit)
    .set(values)
    .where(inArray(bankTransactionSplit.id, ids))
    .run()
}

export function bulkAssignPlanToSplits(
  ids: string[],
  planId: string | null,
  txOrDb: DbOrTransaction = db,
): number {
  if (ids.length === 0) return 0
  const now = new Date()

  const targetSplits = txOrDb
    .select({
      id: bankTransactionSplit.id,
      planId: bankTransactionSplit.planId,
    })
    .from(bankTransactionSplit)
    .where(inArray(bankTransactionSplit.id, ids))
    .all()

  if (targetSplits.length === 0) return 0

  const { idsToClearBudget, idsToKeepBudget } = partitionByPlan(
    targetSplits,
    planId,
  )

  updateSplitPlanGroup(txOrDb, idsToClearBudget, {
    planId,
    budgetId: null,
    updatedAt: now,
  })
  updateSplitPlanGroup(txOrDb, idsToKeepBudget, {
    planId,
    updatedAt: now,
  })

  return targetSplits.length
}

export function bulkArchiveSplits(
  ids: string[],
  isArchived: boolean,
  txOrDb: DbOrTransaction = db,
): number {
  if (ids.length === 0) return 0
  const result = txOrDb
    .update(bankTransactionSplit)
    .set({ isArchived, updatedAt: new Date() })
    .where(inArray(bankTransactionSplit.id, ids))
    .returning({ id: bankTransactionSplit.id })
    .all()
  return result.length
}

export function bulkAssignBudgetToSplits(
  ids: string[],
  budgetId: string | null,
  txOrDb: DbOrTransaction = db,
): number {
  if (ids.length === 0) return 0
  const result = txOrDb
    .update(bankTransactionSplit)
    .set({ budgetId, updatedAt: new Date() })
    .where(inArray(bankTransactionSplit.id, ids))
    .returning({ id: bankTransactionSplit.id })
    .all()
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
