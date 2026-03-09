import type { APIRoute } from 'astro'
import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { bulkAssignBudgetToTransactions } from '@/lib/bank-transactions'
import { bulkAssignBudgetToSplits } from '@/lib/bank-transaction-splits'
import { getTransactionById } from '@/lib/transactions'
import { db } from '@/db/database'
import { bankTransaction, bankTransactionSplit } from '@/db/schema/plans'

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
    return new Response(JSON.stringify({ error: 'Ungültiger Request-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = bulkAssignBudgetSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (parsed.data.budgetId) {
    const budget = await getTransactionById(parsed.data.budgetId)
    if (!budget) {
      return new Response(JSON.stringify({ error: 'Budget nicht gefunden' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!budget.isBudget) {
      return new Response(
        JSON.stringify({ error: 'Transaktion ist kein Budget' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Verify all targeted transactions belong to the budget's plan
    if (parsed.data.ids.length > 0) {
      const targetTxs = await db
        .select({ id: bankTransaction.id, planId: bankTransaction.planId })
        .from(bankTransaction)
        .where(inArray(bankTransaction.id, parsed.data.ids))

      const mismatch = targetTxs.some((tx) => tx.planId !== budget.planId)
      if (mismatch) {
        return new Response(
          JSON.stringify({
            error:
              'Alle Transaktionen müssen dem Plan des Budgets zugewiesen sein',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    // Verify all targeted splits belong to the budget's plan
    if (parsed.data.splitIds.length > 0) {
      const targetSplits = await db
        .select({
          id: bankTransactionSplit.id,
          planId: bankTransactionSplit.planId,
        })
        .from(bankTransactionSplit)
        .where(inArray(bankTransactionSplit.id, parsed.data.splitIds))

      const splitMismatch = targetSplits.some((s) => s.planId !== budget.planId)
      if (splitMismatch) {
        return new Response(
          JSON.stringify({
            error: 'Alle Splits müssen dem Plan des Budgets zugewiesen sein',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }
  }

  try {
    const [txCount, splitCount] = await Promise.all([
      parsed.data.ids.length > 0
        ? bulkAssignBudgetToTransactions(parsed.data.ids, parsed.data.budgetId)
        : 0,
      parsed.data.splitIds.length > 0
        ? bulkAssignBudgetToSplits(parsed.data.splitIds, parsed.data.budgetId)
        : 0,
    ])
    const count = txCount + splitCount

    return new Response(JSON.stringify({ success: true, count }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error bulk assigning budget to bank transactions:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Zuweisen des Budgets',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
