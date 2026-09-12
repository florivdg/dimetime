import type { APIRoute } from 'astro'
import { updatePreset, deletePreset, getPresetById } from '@/lib/presets'
import {
  error,
  handle,
  json,
  requireExisting,
  requireUserId,
  validateBody,
} from '@/lib/api/responses'
import { updatePresetSchema } from './_schema'

// fallow-ignore-next-line code-duplication
export const PUT: APIRoute = async ({ params, request, locals }) => {
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

  const data = await validateBody(request, updatePresetSchema)
  if (data instanceof Response) return data

  return handle(
    async () => {
      const updated = await updatePreset(found.id, data)
      if (!updated) return error('Vorlage nicht gefunden', 404)
      return json(updated)
    },
    'Fehler beim Aktualisieren der Vorlage',
    'Error updating preset',
  )
}

export const DELETE: APIRoute = async ({ params, locals }) => {
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

  return handle(
    async () => {
      const success = await deletePreset(found.id)
      if (!success) return error('Vorlage nicht gefunden', 404)
      return json({ success: true, message: 'Vorlage wurde gelöscht' })
    },
    'Fehler beim Löschen der Vorlage',
    'Error deleting preset',
  )
}
