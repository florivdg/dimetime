import type { APIRoute } from 'astro'
import {
  deleteImportSource,
  getImportSourceById,
  updateImportSource,
} from '@/lib/bank-transactions'
import {
  error,
  handle,
  json,
  parseJson,
  requireExisting,
  validate,
} from '@/lib/api/responses'
import { updateSourceSchema } from './_schema'

export const PUT: APIRoute = async ({ params, request }) => {
  const found = await requireExisting(
    params,
    'id',
    'Import-Quellen-ID',
    getImportSourceById,
    'Import-Quelle nicht gefunden',
  )
  if (found instanceof Response) return found

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(updateSourceSchema, body)
  if (data instanceof Response) return data

  return handle(
    async () => json(await updateImportSource(found.id, data)),
    'Import-Quelle konnte nicht aktualisiert werden',
  )
}

export const DELETE: APIRoute = async ({ params }) => {
  const found = await requireExisting(
    params,
    'id',
    'Import-Quellen-ID',
    getImportSourceById,
    'Import-Quelle nicht gefunden',
  )
  if (found instanceof Response) return found

  return handle(async () => {
    const result = await deleteImportSource(found.id)
    if (!result.deleted) {
      return error(result.error ?? 'Löschen fehlgeschlagen', 409)
    }
    return json({ success: true })
  }, 'Import-Quelle konnte nicht gelöscht werden')
}
