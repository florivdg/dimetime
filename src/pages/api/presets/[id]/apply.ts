import type { APIRoute } from 'astro'
import { z } from 'zod'
import { applyPresetToPlan, getPresetById } from '@/lib/presets'

const applySchema = z.object({
  planId: z.uuid(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const POST: APIRoute = async ({ params, request, locals }) => {
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

  const parsed = applySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const transaction = await applyPresetToPlan(id, parsed.data)
    return new Response(JSON.stringify(transaction), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error applying preset:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Anwenden der Vorlage',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
