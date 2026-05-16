import type { APIRoute } from 'astro'
import { z } from 'zod'
import { db } from '@/db/database'
import { plannedTransaction, plan } from '@/db/schema/plans'
import { eq, inArray } from 'drizzle-orm'
import { adjustDueDateToMonth } from '@/lib/transactions'
import { requireUnarchivedPlan } from '@/lib/api/plan-guards'
import {
  error,
  handle,
  json,
  requireUserId,
  unwrap,
  validateBody,
} from '@/lib/api/responses'

const bulkCopySchema = z.object({
  targetPlanId: z.uuid(),
  transactionIds: z.array(z.uuid()).min(1),
})

function selectSources(transactionIds: string[]) {
  return db
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
}

async function loadSourcesForCopy(
  transactionIds: string[],
): Promise<Awaited<ReturnType<typeof selectSources>> | Response> {
  const sources = await selectSources(transactionIds)
  if (sources.length === 0) {
    return error('Keine gültigen Transaktionen gefunden', 404)
  }
  if (sources.length !== transactionIds.length) {
    return error(
      'Einige der ausgewählten Transaktionen wurden nicht gefunden',
      404,
    )
  }
  return sources
}

export const POST: APIRoute = async ({ request, locals }) =>
  handle(
    async () => {
      unwrap(requireUserId(locals))
      const data = unwrap(await validateBody(request, bulkCopySchema))
      const targetPlan = unwrap(
        await requireUnarchivedPlan(data.targetPlanId, {
          notFound: 'Zielplan nicht gefunden',
          archived: 'Zielplan ist archiviert',
        }),
      )
      const transactionIds = Array.from(new Set(data.transactionIds))
      const sources = unwrap(await loadSourcesForCopy(transactionIds))
      const now = new Date()

      const values = sources.map((source) => ({
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
      await db.insert(plannedTransaction).values(values)
      return json({ success: true, count: values.length }, 201)
    },
    'Fehler beim Kopieren der Transaktionen',
    'Error bulk copying transactions',
  )
