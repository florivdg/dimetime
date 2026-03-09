import type { APIRoute } from 'astro'
import { z } from 'zod'
import { bulkAssignPlanToTransactions } from '@/lib/bank-transactions'
import { bulkAssignPlanToSplits } from '@/lib/bank-transaction-splits'
import { getPlanById } from '@/lib/plans'

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
    return new Response(JSON.stringify({ error: 'Ungültiger Request-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = bulkAssignPlanSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (parsed.data.planId) {
    const targetPlan = await getPlanById(parsed.data.planId)
    if (!targetPlan) {
      return new Response(
        JSON.stringify({ error: 'Zielplan nicht gefunden' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
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

  try {
    const [txCount, splitCount] = await Promise.all([
      parsed.data.ids.length > 0
        ? bulkAssignPlanToTransactions(parsed.data.ids, parsed.data.planId)
        : 0,
      parsed.data.splitIds.length > 0
        ? bulkAssignPlanToSplits(parsed.data.splitIds, parsed.data.planId)
        : 0,
    ])
    const count = txCount + splitCount

    return new Response(JSON.stringify({ success: true, count }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error bulk assigning plan to bank transactions:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Zuweisen des Plans',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
