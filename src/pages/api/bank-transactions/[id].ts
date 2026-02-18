import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  getBankTransactionById,
  updateBankTransactionPlan,
} from '@/lib/bank-transactions'
import { getPlanById } from '@/lib/plans'

const patchSchema = z.object({
  planId: z.uuid().nullable(),
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

  const updated = await updateBankTransactionPlan(id, parsed.data.planId)
  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
