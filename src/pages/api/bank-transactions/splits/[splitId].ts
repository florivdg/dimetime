import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getSplitById, updateSplitFields } from '@/lib/bank-transaction-splits'
import { getTransactionById } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'

const patchSchema = z
  .object({
    budgetId: z.uuid().nullable().optional(),
    planId: z.uuid().nullable().optional(),
  })
  .refine((data) => data.budgetId !== undefined || data.planId !== undefined, {
    message: 'Mindestens ein Feld (budgetId oder planId) ist erforderlich',
  })

export const PATCH: APIRoute = async ({ params, request }) => {
  const splitId = params.splitId
  if (!splitId) {
    return new Response(
      JSON.stringify({ error: 'Split-ID ist erforderlich' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
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

  const existingSplit = await getSplitById(splitId)
  if (!existingSplit) {
    return new Response(JSON.stringify({ error: 'Split nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const effectivePlanId =
    parsed.data.planId !== undefined ? parsed.data.planId : existingSplit.planId

  if (parsed.data.planId !== undefined && parsed.data.planId !== null) {
    const targetPlan = await getPlanById(parsed.data.planId)
    if (!targetPlan) {
      return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (targetPlan.isArchived) {
      return new Response(
        JSON.stringify({
          error:
            'Splits können nicht einem archivierten Plan zugeordnet werden.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  if (parsed.data.budgetId != null) {
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
    if (budget.planId !== effectivePlanId) {
      return new Response(
        JSON.stringify({ error: 'Budget gehört nicht zum zugewiesenen Plan' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  const fields: { planId?: string | null; budgetId?: string | null } = {}
  if (parsed.data.planId !== undefined) fields.planId = parsed.data.planId
  if (parsed.data.budgetId !== undefined) fields.budgetId = parsed.data.budgetId

  const updated = await updateSplitFields(splitId, fields)
  if (!updated) {
    return new Response(JSON.stringify({ error: 'Split nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
