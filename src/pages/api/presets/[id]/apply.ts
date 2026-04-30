import type { APIRoute } from 'astro'
import { z } from 'zod'
import { applyPresetToPlan, getPresetById } from '@/lib/presets'
import {
  error,
  json,
  parseJson,
  unauthorized,
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
  const userId = locals.user?.id
  if (!userId) return unauthorized()

  const { id } = params
  if (!id) return error('Fehlende Preset-ID', 400)

  const existing = await getPresetById(id)
  if (!existing) return error('Vorlage nicht gefunden', 404)
  if (existing.userId !== userId) return error('Nicht autorisiert', 403)

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(applySchema, body)
  if (data instanceof Response) return data

  try {
    const transaction = await applyPresetToPlan(id, data)
    return json(transaction, 201)
  } catch (err) {
    console.error('Error applying preset:', err)
    return error(
      err instanceof Error ? err.message : 'Fehler beim Anwenden der Vorlage',
      500,
    )
  }
}
