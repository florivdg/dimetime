import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getSplitById, updateSplitFields } from '@/lib/bank-transaction-splits'
import { getTransactionById } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'
import {
  jsonError,
  jsonResponse,
  parseJsonBody,
} from '@/lib/bank-import/api-helpers'

const patchSchema = z
  .object({
    budgetId: z.uuid().nullable().optional(),
    planId: z.uuid().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (data) =>
      data.budgetId !== undefined ||
      data.planId !== undefined ||
      data.note !== undefined,
    {
      message:
        'Mindestens ein Feld (budgetId, planId oder note) ist erforderlich',
    },
  )

type PatchInput = z.infer<typeof patchSchema>

async function validatePlanAssignment(
  planId: string | null | undefined,
): Promise<Response | null> {
  if (planId === undefined || planId === null) return null
  const targetPlan = await getPlanById(planId)
  if (!targetPlan) return jsonError('Plan nicht gefunden', 404)
  if (targetPlan.isArchived) {
    return jsonError(
      'Splits können nicht einem archivierten Plan zugeordnet werden.',
    )
  }
  return null
}

async function validateBudgetAssignment(
  budgetId: string | null | undefined,
  effectivePlanId: string | null,
): Promise<Response | null> {
  if (budgetId == null) return null
  const budget = await getTransactionById(budgetId)
  if (!budget) return jsonError('Budget nicht gefunden', 404)
  if (!budget.isBudget) return jsonError('Transaktion ist kein Budget')
  if (budget.planId !== effectivePlanId) {
    return jsonError('Budget gehört nicht zum zugewiesenen Plan')
  }
  return null
}

function buildUpdateFields(data: PatchInput): {
  planId?: string | null
  budgetId?: string | null
  note?: string | null
} {
  const fields: {
    planId?: string | null
    budgetId?: string | null
    note?: string | null
  } = {}
  if (data.planId !== undefined) fields.planId = data.planId
  if (data.budgetId !== undefined) fields.budgetId = data.budgetId
  if (data.note !== undefined) fields.note = data.note
  return fields
}

export const PATCH: APIRoute = async ({ params, request }) => {
  const splitId = params.splitId
  if (!splitId) return jsonError('Split-ID ist erforderlich')

  const parsedResult = await parseJsonBody(request, patchSchema)
  if ('error' in parsedResult) return parsedResult.error

  const existingSplit = await getSplitById(splitId)
  if (!existingSplit) return jsonError('Split nicht gefunden', 404)

  const { data } = parsedResult
  const effectivePlanId =
    data.planId !== undefined ? data.planId : existingSplit.planId

  const planError = await validatePlanAssignment(data.planId)
  if (planError) return planError

  const budgetError = await validateBudgetAssignment(
    data.budgetId,
    effectivePlanId,
  )
  if (budgetError) return budgetError

  const updated = await updateSplitFields(splitId, buildUpdateFields(data))
  if (!updated) return jsonError('Split nicht gefunden', 404)

  return jsonResponse(updated)
}
