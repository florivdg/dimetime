import type { APIRoute } from 'astro'
import { z } from 'zod'
import { applyMultiplePresetsToPlan, getPresetsByIds } from '@/lib/presets'
import { requireUnarchivedPlan } from '@/lib/api/plan-guards'
import {
  error,
  handle,
  json,
  requireUserId,
  unwrap,
  validateBody,
} from '@/lib/api/responses'

const bulkApplySchema = z.object({
  planId: z.uuid(),
  presetIds: z.array(z.uuid()).min(1),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

async function assertPresetsOwned(
  presetIds: string[],
  userId: string,
): Promise<void> {
  const presets = await getPresetsByIds(presetIds)
  if (presets.length !== presetIds.length) {
    throw error('Eine oder mehrere Vorlagen wurden nicht gefunden', 404)
  }
  const foreign = presets.find((p) => p.userId !== userId)
  if (foreign) {
    throw error(`Vorlage ${foreign.id} nicht autorisiert`, 403)
  }
}

export const POST: APIRoute = async ({ request, locals }) =>
  handle(
    async () => {
      const userId = unwrap(requireUserId(locals))
      const data = unwrap(await validateBody(request, bulkApplySchema))
      unwrap(await requireUnarchivedPlan(data.planId))
      await assertPresetsOwned(data.presetIds, userId)

      const result = await applyMultiplePresetsToPlan(data.presetIds, {
        planId: data.planId,
        dueDate: data.dueDate,
      })
      return json(
        {
          success: true,
          count: result.count,
          transactions: result.transactions,
        },
        201,
      )
    },
    'Fehler beim Anwenden der Vorlagen',
    'Error bulk applying presets',
  )
