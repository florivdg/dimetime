import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  getBankTransactionById,
  updateBankTransactionFields,
} from '@/lib/bank-transactions'
import { getPlanById } from '@/lib/plans'

const patchSchema = z
  .object({
    planId: z.uuid().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((data) => data.planId !== undefined || data.note !== undefined, {
    message: 'Mindestens ein Feld (planId oder note) muss angegeben werden.',
  })

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Transaktions-ID ist erforderlich' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const existing = await getBankTransactionById(id)
  if (!existing) {
    return new Response(
      JSON.stringify({ error: 'Banktransaktion nicht gefunden' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (parsed.data.planId !== undefined) {
    if (parsed.data.planId) {
      const targetPlan = await getPlanById(parsed.data.planId)
      if (!targetPlan) {
        return new Response(
          JSON.stringify({ error: 'Zielplan nicht gefunden' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
      if (targetPlan.isArchived) {
        return new Response(
          JSON.stringify({
            error:
              'Banktransaktionen können nicht einem archivierten Plan zugeordnet werden.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }
  }

  const updated = await updateBankTransactionFields(id, {
    ...(parsed.data.planId !== undefined && { planId: parsed.data.planId }),
    ...(parsed.data.note !== undefined && { note: parsed.data.note }),
  })

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
