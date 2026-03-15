import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getSplitById, updateSplitFields } from '@/lib/bank-transaction-splits'
import { getTransactionById } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'
import { jsonError, jsonResponse } from '@/lib/bank-import/api-helpers'

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
  if (!splitId) return jsonError('Split-ID ist erforderlich')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Ungültiges JSON')
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe')
  }

  const existingSplit = await getSplitById(splitId)
  if (!existingSplit) return jsonError('Split nicht gefunden', 404)

  const effectivePlanId =
    parsed.data.planId !== undefined ? parsed.data.planId : existingSplit.planId

  if (parsed.data.planId !== undefined && parsed.data.planId !== null) {
    const targetPlan = await getPlanById(parsed.data.planId)
    if (!targetPlan) return jsonError('Plan nicht gefunden', 404)
    if (targetPlan.isArchived) {
      return jsonError(
        'Splits können nicht einem archivierten Plan zugeordnet werden.',
      )
    }
  }

  if (parsed.data.budgetId != null) {
    const budget = await getTransactionById(parsed.data.budgetId)
    if (!budget) return jsonError('Budget nicht gefunden', 404)
    if (!budget.isBudget) return jsonError('Transaktion ist kein Budget')
    if (budget.planId !== effectivePlanId) {
      return jsonError('Budget gehört nicht zum zugewiesenen Plan')
    }
  }

  const fields: { planId?: string | null; budgetId?: string | null } = {}
  if (parsed.data.planId !== undefined) fields.planId = parsed.data.planId
  if (parsed.data.budgetId !== undefined) fields.budgetId = parsed.data.budgetId

  const updated = await updateSplitFields(splitId, fields)
  if (!updated) return jsonError('Split nicht gefunden', 404)

  return jsonResponse(updated)
}
