import type { APIRoute } from 'astro'
import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { bulkAssignBudgetToTransactions } from '@/lib/bank-transactions'
import { getTransactionById } from '@/lib/transactions'
import { db } from '@/db/database'
import { bankTransaction } from '@/db/schema/plans'

const bulkAssignBudgetSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
  budgetId: z.uuid().nullable(),
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

  try {
    const count = await bulkAssignBudgetToTransactions(
      parsed.data.ids,
      parsed.data.budgetId,
    )

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
