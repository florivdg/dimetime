import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  dismissBankTransaction,
  getBankTransactionInPlan,
  getDismissalByBankTransactionInPlan,
  undismissBankTransaction,
} from '@/lib/kassensturz'
import { json, parseJson, requirePlan } from './_helpers'

const dismissSchema = z.object({
  bankTransactionId: z.uuid(),
  reason: z.string().optional(),
})

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error && /unique|constraint failed/i.test(error.message)
  )
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const planResult = await requirePlan(params.id, { writable: true })
  if ('response' in planResult) {
    return planResult.response
  }
  const { planId } = planResult

  const parsedResult = await parseJson(request, dismissSchema)
  if ('response' in parsedResult) {
    return parsedResult.response
  }
  const parsed = parsedResult.data

  try {
    const [bankTx, existingDismissal] = await Promise.all([
      getBankTransactionInPlan(planId, parsed.bankTransactionId),
      getDismissalByBankTransactionInPlan(planId, parsed.bankTransactionId),
    ])

    if (!bankTx) {
      return json(404, { error: 'Banktransaktion nicht gefunden' })
    }

    if (existingDismissal) {
      return json(409, {
        error: 'Diese Transaktion wurde bereits verworfen.',
      })
    }

    const dismissal = await dismissBankTransaction({
      bankTransactionId: parsed.bankTransactionId,
      planId,
      reason: parsed.reason ?? null,
      userId: locals.user?.id ?? null,
    })

    return json(201, dismissal)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return json(409, {
        error: 'Diese Transaktion wurde bereits verworfen.',
      })
    }

    console.error('Kassensturz Verwerfung fehlgeschlagen:', error)
    return json(500, {
      error:
        error instanceof Error
          ? error.message
          : 'Transaktion konnte nicht verworfen werden',
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
    z.object({ dismissalId: z.uuid() }),
  )
  if ('response' in parsedResult) {
    return parsedResult.response
  }
  const parsed = parsedResult.data

  const deleted = await undismissBankTransaction(planId, parsed.dismissalId)
  if (!deleted) {
    return json(404, { error: 'Verwerfung nicht gefunden' })
  }

  return json(200, { success: true })
}
