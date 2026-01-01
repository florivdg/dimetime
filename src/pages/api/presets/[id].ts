import type { APIRoute } from 'astro'
import { z } from 'zod'
import { updatePreset, deletePreset, getPresetById } from '@/lib/presets'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  note: z.string().max(2000).nullable().optional(),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.number().int().min(0).optional(),
  recurrence: z
    .enum(['einmalig', 'monatlich', 'vierteljährlich', 'jährlich'])
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  categoryId: z.uuid().nullable().optional(),
})

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const userId = locals.user?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = params
  if (!id) {
    return new Response(JSON.stringify({ error: 'Fehlende Preset-ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify preset exists and belongs to user
  const existing = await getPresetById(id)
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Vorlage nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (existing.userId !== userId) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiger Request-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const updated = await updatePreset(id, parsed.data)
    if (!updated) {
      return new Response(JSON.stringify({ error: 'Vorlage nicht gefunden' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error updating preset:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Aktualisieren der Vorlage',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  const userId = locals.user?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = params
  if (!id) {
    return new Response(JSON.stringify({ error: 'Fehlende Preset-ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify preset exists and belongs to user
  const existing = await getPresetById(id)
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Vorlage nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (existing.userId !== userId) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const success = await deletePreset(id)
    if (!success) {
      return new Response(JSON.stringify({ error: 'Vorlage nicht gefunden' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Vorlage wurde gelöscht' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error deleting preset:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Löschen der Vorlage',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
