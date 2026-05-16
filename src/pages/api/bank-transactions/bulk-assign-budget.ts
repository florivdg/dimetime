import type { APIRoute } from 'astro'
import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { bulkAssignBudgetToTransactions } from '@/lib/bank-transactions'
import { bulkAssignBudgetToSplits } from '@/lib/bank-transaction-splits'
import { getTransactionById } from '@/lib/transactions'
import { db } from '@/db/database'
import { bankTransaction, bankTransactionSplit } from '@/db/schema/plans'
import {
  jsonError,
  jsonResponse,
  parseJsonBody,
} from '@/lib/bank-import/api-helpers'

const bulkAssignBudgetSchema = z
  .object({
    ids: z.array(z.uuid()).max(100).default([]),
    splitIds: z.array(z.uuid()).max(100).default([]),
    budgetId: z.uuid().nullable(),
  })
  .refine((data) => data.ids.length > 0 || data.splitIds.length > 0, {
    message: 'Mindestens eine Transaktions- oder Split-ID ist erforderlich',
  })

type BulkAssignBudgetInput = z.infer<typeof bulkAssignBudgetSchema>

async function fetchTargetTxPlanIds(ids: string[]) {
  if (ids.length === 0) return []
  return db
    .select({ id: bankTransaction.id, planId: bankTransaction.planId })
    .from(bankTransaction)
    .where(inArray(bankTransaction.id, ids))
}

async function fetchTargetSplitPlanIds(splitIds: string[]) {
  if (splitIds.length === 0) return []
  return db
    .select({
      id: bankTransactionSplit.id,
      planId: bankTransactionSplit.planId,
    })
    .from(bankTransactionSplit)
    .where(inArray(bankTransactionSplit.id, splitIds))
}

async function validateBudgetAndPlan(
  data: BulkAssignBudgetInput,
): Promise<Response | null> {
  if (!data.budgetId) return null
  const budget = await getTransactionById(data.budgetId)
  if (!budget) return jsonError('Budget nicht gefunden', 404)
  if (!budget.isBudget) return jsonError('Transaktion ist kein Budget')

  const [targetTxs, targetSplits] = await Promise.all([
    fetchTargetTxPlanIds(data.ids),
    fetchTargetSplitPlanIds(data.splitIds),
  ])

  const mismatch =
    targetTxs.some((tx) => tx.planId !== budget.planId) ||
    targetSplits.some((s) => s.planId !== budget.planId)
  if (mismatch) {
    return jsonError(
      'Alle Transaktionen/Splits müssen dem Plan des Budgets zugewiesen sein',
    )
  }
  return null
}

async function applyBulkAssign(data: BulkAssignBudgetInput): Promise<number> {
  return db.transaction(async (tx) => {
    const [txCount, splitCount] = await Promise.all([
      data.ids.length > 0
        ? bulkAssignBudgetToTransactions(data.ids, data.budgetId, tx)
        : 0,
      data.splitIds.length > 0
        ? bulkAssignBudgetToSplits(data.splitIds, data.budgetId, tx)
        : 0,
    ])
    return txCount + splitCount
  })
}

export const POST: APIRoute = async ({ request }) => {
  const parsedResult = await parseJsonBody(
    request,
    bulkAssignBudgetSchema,
    'Ungültiger Request-Body',
  )
  if ('error' in parsedResult) return parsedResult.error

  const validationError = await validateBudgetAndPlan(parsedResult.data)
  if (validationError) return validationError

  try {
    const count = await applyBulkAssign(parsedResult.data)
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
