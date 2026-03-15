import type { APIRoute } from 'astro'
import { z } from 'zod'
import { bulkAssignPlanToTransactions } from '@/lib/bank-transactions'
import { bulkAssignPlanToSplits } from '@/lib/bank-transaction-splits'
import { getPlanById } from '@/lib/plans'
import { jsonError, jsonResponse } from '@/lib/bank-import/api-helpers'

const bulkAssignPlanSchema = z
  .object({
    ids: z.array(z.uuid()).max(100).default([]),
    splitIds: z.array(z.uuid()).max(100).default([]),
    planId: z.uuid().nullable(),
  })
  .refine((data) => data.ids.length > 0 || data.splitIds.length > 0, {
    message: 'Mindestens eine Transaktions- oder Split-ID ist erforderlich',
  })

export const POST: APIRoute = async ({ request }) => {
  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('Ungültiger Request-Body')
  }

  const parsed = bulkAssignPlanSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe')
  }

  if (parsed.data.planId) {
    const targetPlan = await getPlanById(parsed.data.planId)
    if (!targetPlan) return jsonError('Zielplan nicht gefunden', 404)
    if (targetPlan.isArchived) {
      return jsonError(
        'Banktransaktionen können nicht einem archivierten Plan zugeordnet werden.',
      )
    }
  }

  try {
    const [txCount, splitCount] = await Promise.all([
      parsed.data.ids.length > 0
        ? bulkAssignPlanToTransactions(parsed.data.ids, parsed.data.planId)
        : 0,
      parsed.data.splitIds.length > 0
        ? bulkAssignPlanToSplits(parsed.data.splitIds, parsed.data.planId)
        : 0,
    ])

    return jsonResponse({ success: true, count: txCount + splitCount })
  } catch (error) {
    console.error('Error bulk assigning plan to bank transactions:', error)
    return jsonError(
      error instanceof Error ? error.message : 'Fehler beim Zuweisen des Plans',
      500,
    )
  }
}
