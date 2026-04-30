import type { APIRoute } from 'astro'
import { z } from 'zod'
import { updatePreset, deletePreset, getPresetById } from '@/lib/presets'
import {
  error,
  json,
  parseJson,
  unauthorized,
  validate,
} from '@/lib/api/responses'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  note: z.string().max(2000).nullable().optional(),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.number().int().min(0).optional(),
  recurrence: z
    .enum(['einmalig', 'monatlich', 'vierteljährlich', 'jährlich'])
    .optional(),
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  categoryId: z.uuid().nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  isBudget: z.boolean().optional(),
})

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const userId = locals.user?.id
  if (!userId) return unauthorized()

  const { id } = params
  if (!id) return error('Fehlende Preset-ID', 400)

  const existing = await getPresetById(id)
  if (!existing) return error('Vorlage nicht gefunden', 404)
  if (existing.userId !== userId) return error('Nicht autorisiert', 403)

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(updateSchema, body)
  if (data instanceof Response) return data

  try {
    const updated = await updatePreset(id, data)
    if (!updated) return error('Vorlage nicht gefunden', 404)
    return json(updated)
  } catch (err) {
    console.error('Error updating preset:', err)
    return error(
      err instanceof Error
        ? err.message
        : 'Fehler beim Aktualisieren der Vorlage',
      500,
    )
  }
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  const userId = locals.user?.id
  if (!userId) return unauthorized()

  const { id } = params
  if (!id) return error('Fehlende Preset-ID', 400)

  const existing = await getPresetById(id)
  if (!existing) return error('Vorlage nicht gefunden', 404)
  if (existing.userId !== userId) return error('Nicht autorisiert', 403)

  try {
    const success = await deletePreset(id)
    if (!success) return error('Vorlage nicht gefunden', 404)
    return json({ success: true, message: 'Vorlage wurde gelöscht' })
  } catch (err) {
    console.error('Error deleting preset:', err)
    return error(
      err instanceof Error ? err.message : 'Fehler beim Löschen der Vorlage',
      500,
    )
  }
}
