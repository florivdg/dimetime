import type { APIRoute } from 'astro'
import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { bulkAssignBudgetToTransactions } from '@/lib/bank-transactions'
import { bulkAssignBudgetToSplits } from '@/lib/bank-transaction-splits'
import { getTransactionById } from '@/lib/transactions'
import { db } from '@/db/database'
import { bankTransaction, bankTransactionSplit } from '@/db/schema/plans'
import { jsonError, jsonResponse } from '@/lib/bank-import/api-helpers'

const bulkAssignBudgetSchema = z
  .object({
    ids: z.array(z.uuid()).max(100).default([]),
    splitIds: z.array(z.uuid()).max(100).default([]),
    budgetId: z.uuid().nullable(),
  })
  .refine((data) => data.ids.length > 0 || data.splitIds.length > 0, {
    message: 'Mindestens eine Transaktions- oder Split-ID ist erforderlich',
  })

export const POST: APIRoute = async ({ request }) => {
  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('Ungültiger Request-Body')
  }

  const parsed = bulkAssignBudgetSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe')
  }

  if (parsed.data.budgetId) {
    const budget = await getTransactionById(parsed.data.budgetId)
    if (!budget) return jsonError('Budget nicht gefunden', 404)
    if (!budget.isBudget) return jsonError('Transaktion ist kein Budget')

    // Verify all targeted transactions/splits belong to the budget's plan
    const [targetTxs, targetSplits] = await Promise.all([
      parsed.data.ids.length > 0
        ? db
            .select({ id: bankTransaction.id, planId: bankTransaction.planId })
            .from(bankTransaction)
            .where(inArray(bankTransaction.id, parsed.data.ids))
        : [],
      parsed.data.splitIds.length > 0
        ? db
            .select({
              id: bankTransactionSplit.id,
              planId: bankTransactionSplit.planId,
            })
            .from(bankTransactionSplit)
            .where(inArray(bankTransactionSplit.id, parsed.data.splitIds))
        : [],
    ])

    const mismatch =
      targetTxs.some((tx) => tx.planId !== budget.planId) ||
      targetSplits.some((s) => s.planId !== budget.planId)
    if (mismatch) {
      return jsonError(
        'Alle Transaktionen/Splits müssen dem Plan des Budgets zugewiesen sein',
      )
    }
  }

  try {
    const count = await db.transaction(async (tx) => {
      const [txCount, splitCount] = await Promise.all([
        parsed.data.ids.length > 0
          ? bulkAssignBudgetToTransactions(
              parsed.data.ids,
              parsed.data.budgetId,
              tx,
            )
          : 0,
        parsed.data.splitIds.length > 0
          ? bulkAssignBudgetToSplits(
              parsed.data.splitIds,
              parsed.data.budgetId,
              tx,
            )
          : 0,
      ])
      return txCount + splitCount
    })

    return jsonResponse({ success: true, count })
  } catch (error) {
    console.error('Error bulk assigning budget to bank transactions:', error)
    return jsonError(
      error instanceof Error
        ? error.message
        : 'Fehler beim Zuweisen des Budgets',
      500,
    )
  }
}
