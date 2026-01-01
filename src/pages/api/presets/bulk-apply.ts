import type { APIRoute } from 'astro'
import { z } from 'zod'
import { applyMultiplePresetsToPlan, getPresetById } from '@/lib/presets'
import { getPlanById } from '@/lib/plans'

const bulkApplySchema = z.object({
  planId: z.uuid(),
  presetIds: z.array(z.uuid()).min(1),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = locals.user?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiger Request-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = bulkApplySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Validate plan
  const plan = await getPlanById(parsed.data.planId)
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (plan.isArchived) {
    return new Response(JSON.stringify({ error: 'Plan ist archiviert' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify all presets belong to user
  for (const presetId of parsed.data.presetIds) {
    const preset = await getPresetById(presetId)
    if (!preset || preset.userId !== userId) {
      return new Response(
        JSON.stringify({
          error: `Vorlage ${presetId} nicht gefunden oder nicht autorisiert`,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  try {
    const result = await applyMultiplePresetsToPlan(parsed.data.presetIds, {
      planId: parsed.data.planId,
      dueDate: parsed.data.dueDate,
    })

    return new Response(
      JSON.stringify({
        success: true,
        count: result.count,
        transactions: result.transactions,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error bulk applying presets:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Anwenden der Vorlagen',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
