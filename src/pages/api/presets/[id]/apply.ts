import type { APIRoute } from 'astro'
import { z } from 'zod'
import { applyPresetToPlan, getPresetById } from '@/lib/presets'
import { requireUnarchivedPlan } from '@/lib/api/plan-guards'
import {
  handle,
  json,
  requireExisting,
  requireUserId,
  unwrap,
  validateBody,
} from '@/lib/api/responses'

const applySchema = z.object({
  planId: z.uuid(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

// fallow-ignore-next-line code-duplication
export const POST: APIRoute = async ({ params, request, locals }) => {
  const userId = requireUserId(locals)
  if (userId instanceof Response) return userId

  const found = await requireExisting(
    params,
    'id',
    'Preset-ID',
    getPresetById,
    'Vorlage nicht gefunden',
  )
  if (found instanceof Response) return found

  const data = await validateBody(request, applySchema)
  if (data instanceof Response) return data

  return handle(
    async () => {
      unwrap(await requireUnarchivedPlan(data.planId))
      return json(await applyPresetToPlan(found.id, data), 201)
    },
    'Fehler beim Anwenden der Vorlage',
    'Error applying preset',
  )
}
