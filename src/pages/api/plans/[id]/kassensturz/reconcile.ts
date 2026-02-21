import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  getBankTransactionInPlan,
  getPlannedTransactionInPlan,
  removeReconciliation,
} from '@/lib/kassensturz'
import { createManualReconciliationSafely } from '@/lib/bank-transactions'
import { json, parseJson, requirePlan } from './_helpers'

const reconcileSchema = z.object({
  bankTransactionId: z.uuid(),
  plannedTransactionId: z.uuid(),
})

export const POST: APIRoute = async ({ params, request, locals }) => {
  const planResult = await requirePlan(params.id, { writable: true })
  if ('response' in planResult) {
    return planResult.response
  }
  const { planId } = planResult

  const parsedResult = await parseJson(request, reconcileSchema)
  if ('response' in parsedResult) {
    return parsedResult.response
  }
  const parsed = parsedResult.data

  try {
    const [bankTx, plannedTx] = await Promise.all([
      getBankTransactionInPlan(planId, parsed.bankTransactionId),
      getPlannedTransactionInPlan(planId, parsed.plannedTransactionId),
    ])

    if (!bankTx) {
      return json(404, { error: 'Banktransaktion nicht gefunden' })
    }

    if (!plannedTx) {
      return json(404, { error: 'Geplante Transaktion nicht gefunden' })
    }

    const result = await createManualReconciliationSafely({
      bankTransactionId: parsed.bankTransactionId,
      plannedTransactionId: parsed.plannedTransactionId,
      matchedByUserId: locals.user?.id ?? null,
    })

    if (result.status === 'created') {
      return json(201, result.reconciliation)
    }

    // result.status === 'bank_conflict'
    return json(409, {
      error: 'Diese Banktransaktion wurde bereits abgeglichen.',
    })
  } catch (error) {
    console.error('Kassensturz Zuordnung fehlgeschlagen:', error)
    return json(500, {
      error:
        error instanceof Error
          ? error.message
          : 'Zuordnung konnte nicht erstellt werden',
    })
  }
}

export const DELETE: APIRoute = async ({ params, request }) => {
  const planResult = await requirePlan(params.id, { writable: true })
  if ('response' in planResult) {
    return planResult.response
  }
  const { planId } = planResult

  const parsedResult = await parseJson(
    request,
    z.object({ reconciliationId: z.uuid() }),
  )
  if ('response' in parsedResult) {
    return parsedResult.response
  }
  const parsed = parsedResult.data

  const deleted = await removeReconciliation(planId, parsed.reconciliationId)
  if (!deleted) {
    return json(404, { error: 'Zuordnung nicht gefunden' })
  }

  return json(200, { success: true })
}
