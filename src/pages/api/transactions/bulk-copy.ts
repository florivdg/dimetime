import type { APIRoute } from 'astro'
import { z } from 'zod'
import { db } from '@/db/database'
import { plannedTransaction, plan } from '@/db/schema/plans'
import { eq, inArray } from 'drizzle-orm'
import { adjustDueDateToMonth } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'

const bulkCopySchema = z.object({
  targetPlanId: z.uuid(),
  transactionIds: z.array(z.uuid()).min(1),
})

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = locals.user?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiger Request-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = bulkCopySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const transactionIds = Array.from(new Set(parsed.data.transactionIds))

  // Validate target plan
  const targetPlan = await getPlanById(parsed.data.targetPlanId)
  if (!targetPlan) {
    return new Response(JSON.stringify({ error: 'Zielplan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (targetPlan.isArchived) {
    return new Response(JSON.stringify({ error: 'Zielplan ist archiviert' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get all source transactions with their plan info
  const sourceTransactions = await db
    .select({
      id: plannedTransaction.id,
      name: plannedTransaction.name,
      note: plannedTransaction.note,
      type: plannedTransaction.type,
      dueDate: plannedTransaction.dueDate,
      amount: plannedTransaction.amount,
      categoryId: plannedTransaction.categoryId,
      planId: plannedTransaction.planId,
    })
    .from(plannedTransaction)
    .innerJoin(plan, eq(plannedTransaction.planId, plan.id))
    .where(inArray(plannedTransaction.id, transactionIds))

  if (sourceTransactions.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Keine gültigen Transaktionen gefunden' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (sourceTransactions.length !== transactionIds.length) {
    return new Response(
      JSON.stringify({
        error: 'Einige der ausgewählten Transaktionen wurden nicht gefunden',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const now = new Date()

    const valuesToInsert = sourceTransactions.map((source) => ({
      name: source.name,
      note: source.note,
      type: source.type,
      dueDate: adjustDueDateToMonth(source.dueDate, targetPlan.date),
      amount: source.amount,
      isDone: false,
      planId: parsed.data.targetPlanId,
      categoryId: source.categoryId,
      createdAt: now,
      updatedAt: now,
    }))

    await db.insert(plannedTransaction).values(valuesToInsert)

    const count = valuesToInsert.length

    return new Response(
      JSON.stringify({
        success: true,
        count,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error bulk copying transactions:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Kopieren der Transaktionen',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
