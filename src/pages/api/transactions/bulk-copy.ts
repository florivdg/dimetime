import type { APIRoute } from 'astro'
import { z } from 'zod'
import { db } from '@/db/database'
import { plannedTransaction, plan } from '@/db/schema/plans'
import { eq, inArray } from 'drizzle-orm'
import { adjustDueDateToMonth } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'
import {
  error,
  handle,
  json,
  parseJson,
  requireUserId,
  validate,
} from '@/lib/api/responses'

const bulkCopySchema = z.object({
  targetPlanId: z.uuid(),
  transactionIds: z.array(z.uuid()).min(1),
})

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = requireUserId(locals)
  if (userId instanceof Response) return userId

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(bulkCopySchema, body)
  if (data instanceof Response) return data

  const transactionIds = Array.from(new Set(data.transactionIds))

  const targetPlan = await getPlanById(data.targetPlanId)
  if (!targetPlan) return error('Zielplan nicht gefunden', 404)
  if (targetPlan.isArchived) return error('Zielplan ist archiviert', 400)

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
    return error('Keine gültigen Transaktionen gefunden', 404)
  }

  if (sourceTransactions.length !== transactionIds.length) {
    return error(
      'Einige der ausgewählten Transaktionen wurden nicht gefunden',
      404,
    )
  }

  return handle(
    async () => {
      const now = new Date()
      const valuesToInsert = sourceTransactions.map((source) => ({
        name: source.name,
        note: source.note,
        type: source.type,
        dueDate: adjustDueDateToMonth(source.dueDate, targetPlan.date),
        amount: source.amount,
        isDone: false,
        planId: data.targetPlanId,
        categoryId: source.categoryId,
        createdAt: now,
        updatedAt: now,
      }))
      await db.insert(plannedTransaction).values(valuesToInsert)
      return json({ success: true, count: valuesToInsert.length }, 201)
    },
    'Fehler beim Kopieren der Transaktionen',
    'Error bulk copying transactions',
  )
}
