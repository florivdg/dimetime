import type { APIRoute } from 'astro'
import { z } from 'zod'
import { bulkAssignPlanToTransactions } from '@/lib/bank-transactions'
import { bulkAssignPlanToSplits } from '@/lib/bank-transaction-splits'
import { getPlanById } from '@/lib/plans'
import { db } from '@/db/database'
import {
  jsonError,
  jsonResponse,
  parseJsonBody,
} from '@/lib/bank-import/api-helpers'

const bulkAssignPlanSchema = z
  .object({
    ids: z.array(z.uuid()).max(100).default([]),
    splitIds: z.array(z.uuid()).max(100).default([]),
    planId: z.uuid().nullable(),
  })
  .refine((data) => data.ids.length > 0 || data.splitIds.length > 0, {
    message: 'Mindestens eine Transaktions- oder Split-ID ist erforderlich',
  })

type BulkAssignPlanInput = z.infer<typeof bulkAssignPlanSchema>

async function validateTargetPlan(
  planId: string | null,
): Promise<Response | null> {
  if (!planId) return null
  const targetPlan = await getPlanById(planId)
  if (!targetPlan) return jsonError('Zielplan nicht gefunden', 404)
  if (targetPlan.isArchived) {
    return jsonError(
      'Banktransaktionen können nicht einem archivierten Plan zugeordnet werden.',
    )
  }
  return null
}

async function applyBulkAssign(data: BulkAssignPlanInput): Promise<number> {
  return db.transaction(async (tx) => {
    const [txCount, splitCount] = await Promise.all([
      data.ids.length > 0
        ? bulkAssignPlanToTransactions(data.ids, data.planId, tx)
        : 0,
      data.splitIds.length > 0
        ? bulkAssignPlanToSplits(data.splitIds, data.planId, tx)
        : 0,
    ])
    return txCount + splitCount
  })
}

export const POST: APIRoute = async ({ request }) => {
  const parsedResult = await parseJsonBody(
    request,
    bulkAssignPlanSchema,
    'Ungültiger Request-Body',
  )
  if ('error' in parsedResult) return parsedResult.error

  const planError = await validateTargetPlan(parsedResult.data.planId)
  if (planError) return planError

  try {
    const count = await applyBulkAssign(parsedResult.data)
    return jsonResponse({ success: true, count })
  } catch (error) {
    console.error('Error bulk assigning plan to bank transactions:', error)
    return jsonError(
      error instanceof Error ? error.message : 'Fehler beim Zuweisen des Plans',
      500,
    )
  }
}
