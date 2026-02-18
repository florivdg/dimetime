import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteImportSource,
  getImportSourceById,
  updateImportSource,
} from '@/lib/bank-transactions'

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
  if (!id) {
    return new Response(JSON.stringify({ error: 'Import-Quellen-ID fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const existing = await getImportSourceById(id)
  if (!existing) {
    return new Response(
      JSON.stringify({ error: 'Import-Quelle nicht gefunden' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = updateSourceSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const updated = await updateImportSource(id, parsed.data)
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Import-Quelle konnte nicht aktualisiert werden:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Import-Quelle konnte nicht aktualisiert werden',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id
  if (!id) {
    return new Response(JSON.stringify({ error: 'Import-Quellen-ID fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const existing = await getImportSourceById(id)
  if (!existing) {
    return new Response(
      JSON.stringify({ error: 'Import-Quelle nicht gefunden' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const result = await deleteImportSource(id)
    if (!result.deleted) {
      return new Response(
        JSON.stringify({ error: result.error ?? 'Löschen fehlgeschlagen' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Import-Quelle konnte nicht gelöscht werden:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Import-Quelle konnte nicht gelöscht werden',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
