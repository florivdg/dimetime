import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  getBankTransactionById,
  updateBankTransactionFields,
} from '@/lib/bank-transactions'
import { getPlanById } from '@/lib/plans'
import { getTransactionById } from '@/lib/transactions'

const patchSchema = z
  .object({
    planId: z.uuid().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
    budgetId: z.uuid().nullable().optional(),
  })
  .refine(
    (data) =>
      data.planId !== undefined ||
      data.note !== undefined ||
      data.budgetId !== undefined,
    {
      message:
        'Mindestens ein Feld (planId, note oder budgetId) muss angegeben werden.',
    },
  )

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

  if (parsed.data.budgetId !== undefined && parsed.data.budgetId !== null) {
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
    // Budget must belong to the transaction's plan
    const effectivePlanId =
      parsed.data.planId !== undefined ? parsed.data.planId : existing.planId
    if (budget.planId !== effectivePlanId) {
      return new Response(
        JSON.stringify({ error: 'Budget gehört nicht zum zugewiesenen Plan' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  const updated = await updateBankTransactionFields(id, {
    ...(parsed.data.planId !== undefined && { planId: parsed.data.planId }),
    ...(parsed.data.note !== undefined && { note: parsed.data.note }),
    ...(parsed.data.budgetId !== undefined && {
      budgetId: parsed.data.budgetId,
    }),
  })

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
