import type { APIRoute } from 'astro'
import { updatePreset, deletePreset, getPresetById } from '@/lib/presets'
import {
  error,
  handle,
  json,
  requireOwned,
  validateBody,
} from '@/lib/api/responses'
import { updatePresetSchema } from './_schema'

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const owned = await requireOwned(
    params,
    'id',
    'Preset-ID',
    locals,
    getPresetById,
    'Vorlage nicht gefunden',
  )
  if (owned instanceof Response) return owned

  const data = await validateBody(request, updatePresetSchema)
  if (data instanceof Response) return data

  return handle(
    async () => {
      const updated = await updatePreset(owned.id, data)
      if (!updated) return error('Vorlage nicht gefunden', 404)
      return json(updated)
    },
    'Fehler beim Aktualisieren der Vorlage',
    'Error updating preset',
  )
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  const owned = await requireOwned(
    params,
    'id',
    'Preset-ID',
    locals,
    getPresetById,
    'Vorlage nicht gefunden',
  )
  if (owned instanceof Response) return owned

  return handle(
    async () => {
      const success = await deletePreset(owned.id)
      if (!success) return error('Vorlage nicht gefunden', 404)
      return json({ success: true, message: 'Vorlage wurde gelöscht' })
    },
    'Fehler beim Löschen der Vorlage',
    'Error deleting preset',
  )
}
