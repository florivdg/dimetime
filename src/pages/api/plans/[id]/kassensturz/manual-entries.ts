import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  createManualEntry,
  deleteManualEntry,
  getPlannedTransactionInPlan,
  updateManualEntry,
} from '@/lib/kassensturz'
import { json, parseJson, requirePlan } from './_helpers'

const createSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  note: z.string().optional(),
  amountCents: z.number().int().positive('Betrag muss positiv sein'),
  type: z.enum(['income', 'expense']),
  plannedTransactionId: z.uuid().optional(),
})

const updateSchema = z.object({
  entryId: z.uuid(),
  name: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  amountCents: z.number().int().positive().optional(),
  type: z.enum(['income', 'expense']).optional(),
  plannedTransactionId: z.uuid().nullable().optional(),
})

const deleteSchema = z.object({
  entryId: z.uuid(),
})

export const POST: APIRoute = async ({ params, request, locals }) => {
  const planResult = await requirePlan(params.id, { writable: true })
  if ('response' in planResult) {
    return planResult.response
  }
  const { planId } = planResult

  const parsedResult = await parseJson(request, createSchema)
  if ('response' in parsedResult) {
    return parsedResult.response
  }
  const parsed = parsedResult.data

  try {
    if (parsed.plannedTransactionId) {
      const plannedTx = await getPlannedTransactionInPlan(
        planId,
        parsed.plannedTransactionId,
      )
      if (!plannedTx) {
        return json(404, { error: 'Geplante Transaktion nicht gefunden' })
      }
    }

    const entry = await createManualEntry({
      planId,
      name: parsed.name,
      note: parsed.note ?? null,
      amountCents: parsed.amountCents,
      type: parsed.type,
      plannedTransactionId: parsed.plannedTransactionId ?? null,
      userId: locals.user?.id ?? null,
    })

    return json(201, entry)
  } catch (error) {
    console.error('Manueller Eintrag erstellen fehlgeschlagen:', error)
    return json(500, {
      error:
        error instanceof Error
          ? error.message
          : 'Eintrag konnte nicht erstellt werden',
    })
  }
}

export const PUT: APIRoute = async ({ params, request }) => {
  const planResult = await requirePlan(params.id, { writable: true })
  if ('response' in planResult) {
    return planResult.response
  }
  const { planId } = planResult

  const parsedResult = await parseJson(request, updateSchema)
  if ('response' in parsedResult) {
    return parsedResult.response
  }
  const parsed = parsedResult.data

  const { entryId, ...updateData } = parsed

  if (updateData.plannedTransactionId) {
    const plannedTx = await getPlannedTransactionInPlan(
      planId,
      updateData.plannedTransactionId,
    )
    if (!plannedTx) {
      return json(404, { error: 'Geplante Transaktion nicht gefunden' })
    }
  }

  const updated = await updateManualEntry(planId, entryId, updateData)
  if (!updated) {
    return json(404, { error: 'Eintrag nicht gefunden' })
  }

  return json(200, updated)
}

export const DELETE: APIRoute = async ({ params, request }) => {
  const planResult = await requirePlan(params.id, { writable: true })
  if ('response' in planResult) {
    return planResult.response
  }
  const { planId } = planResult

  const parsedResult = await parseJson(request, deleteSchema)
  if ('response' in parsedResult) {
    return parsedResult.response
  }
  const parsed = parsedResult.data

  const deleted = await deleteManualEntry(planId, parsed.entryId)
  if (!deleted) {
    return json(404, { error: 'Eintrag nicht gefunden' })
  }

  return json(200, { success: true })
}
