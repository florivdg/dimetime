import type { APIRoute } from 'astro'
import { z } from 'zod'
import { applyMultiplePresetsToPlan, getPresetById } from '@/lib/presets'
import { getPlanById } from '@/lib/plans'
import {
  error,
  handle,
  json,
  parseJson,
  requireUserId,
  validate,
} from '@/lib/api/responses'

const bulkApplySchema = z.object({
  planId: z.uuid(),
  presetIds: z.array(z.uuid()).min(1),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = requireUserId(locals)
  if (userId instanceof Response) return userId

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(bulkApplySchema, body)
  if (data instanceof Response) return data

  const plan = await getPlanById(data.planId)
  if (!plan) return error('Plan nicht gefunden', 404)
  if (plan.isArchived) return error('Plan ist archiviert', 400)

  for (const presetId of data.presetIds) {
    const preset = await getPresetById(presetId)
    if (!preset || preset.userId !== userId) {
      return error(
        `Vorlage ${presetId} nicht gefunden oder nicht autorisiert`,
        403,
      )
    }
  }

  return handle(
    async () => {
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
}
