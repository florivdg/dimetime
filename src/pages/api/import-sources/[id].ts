import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteImportSource,
  getImportSourceById,
  updateImportSource,
} from '@/lib/bank-transactions'
import { error, json, parseJson, validate } from '@/lib/api/responses'

const updateSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  preset: z.enum(['ing_csv_v1', 'easybank_xlsx_v1']).optional(),
  sourceKind: z.enum(['bank_account', 'credit_card', 'other']).optional(),
  bankName: z.string().max(200).nullable().optional(),
  accountLabel: z.string().max(200).nullable().optional(),
  accountIdentifier: z.string().max(200).nullable().optional(),
  defaultPlanAssignment: z.enum(['auto_month', 'none']).optional(),
  isActive: z.boolean().optional(),
})

export const PUT: APIRoute = async ({ params, request }) => {
  const id = params.id
  if (!id) return error('Import-Quellen-ID fehlt', 400)

  const existing = await getImportSourceById(id)
  if (!existing) return error('Import-Quelle nicht gefunden', 404)

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(updateSourceSchema, body)
  if (data instanceof Response) return data

  try {
    const updated = await updateImportSource(id, data)
    return json(updated)
  } catch (err) {
    console.error('Import-Quelle konnte nicht aktualisiert werden:', err)
    return error(
      err instanceof Error
        ? err.message
        : 'Import-Quelle konnte nicht aktualisiert werden',
      500,
    )
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id
  if (!id) return error('Import-Quellen-ID fehlt', 400)

  const existing = await getImportSourceById(id)
  if (!existing) return error('Import-Quelle nicht gefunden', 404)

  try {
    const result = await deleteImportSource(id)
    if (!result.deleted) {
      return error(result.error ?? 'Löschen fehlgeschlagen', 409)
    }
    return json({ success: true })
  } catch (err) {
    console.error('Import-Quelle konnte nicht gelöscht werden:', err)
    return error(
      err instanceof Error
        ? err.message
        : 'Import-Quelle konnte nicht gelöscht werden',
      500,
    )
  }
}
