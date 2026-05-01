import type { APIRoute } from 'astro'
import { z } from 'zod'
import { applyPresetToPlan, getPresetById } from '@/lib/presets'
import {
  handle,
  json,
  parseJson,
  requireOwned,
  validate,
} from '@/lib/api/responses'

const applySchema = z.object({
  planId: z.uuid(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const POST: APIRoute = async ({ params, request, locals }) => {
  const owned = await requireOwned(
    params,
    'id',
    'Preset-ID',
    locals,
    getPresetById,
    'Vorlage nicht gefunden',
  )
  if (owned instanceof Response) return owned

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(applySchema, body)
  if (data instanceof Response) return data

  return handle(
    async () => json(await applyPresetToPlan(owned.id, data), 201),
    'Fehler beim Anwenden der Vorlage',
    'Error applying preset',
  )
}
