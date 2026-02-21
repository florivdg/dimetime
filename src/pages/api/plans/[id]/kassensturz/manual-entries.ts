import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getPlanById } from '@/lib/plans'
import {
  createManualEntry,
  updateManualEntry,
  deleteManualEntry,
} from '@/lib/kassensturz'

const createSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  note: z.string().optional(),
  amountCents: z.number().int().positive('Betrag muss positiv sein'),
  type: z.enum(['income', 'expense']),
  plannedTransactionId: z.uuid().optional(),
})

const updateSchema = z.object({
  entryId: z.uuid(),
  name: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  amountCents: z.number().int().positive().optional(),
  type: z.enum(['income', 'expense']).optional(),
  plannedTransactionId: z.uuid().nullable().optional(),
})

const deleteSchema = z.object({
  entryId: z.uuid(),
})

export const POST: APIRoute = async ({ params, request, locals }) => {
  const planId = params.id
  if (!planId) {
    return new Response(JSON.stringify({ error: 'Plan-ID fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const plan = await getPlanById(planId)
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (plan.isArchived) {
    return new Response(
      JSON.stringify({
        error: 'Plan ist archiviert - keine Änderungen möglich',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
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

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const entry = await createManualEntry({
      planId,
      name: parsed.data.name,
      note: parsed.data.note ?? null,
      amountCents: parsed.data.amountCents,
      type: parsed.data.type,
      plannedTransactionId: parsed.data.plannedTransactionId ?? null,
      userId: locals.user?.id ?? null,
    })

    return new Response(JSON.stringify(entry), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Manueller Eintrag erstellen fehlgeschlagen:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Eintrag konnte nicht erstellt werden',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const PUT: APIRoute = async ({ params, request }) => {
  const planId = params.id
  if (!planId) {
    return new Response(JSON.stringify({ error: 'Plan-ID fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const plan = await getPlanById(planId)
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (plan.isArchived) {
    return new Response(
      JSON.stringify({
        error: 'Plan ist archiviert - keine Änderungen möglich',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
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

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { entryId, ...updateData } = parsed.data

  const updated = await updateManualEntry(entryId, updateData)
  if (!updated) {
    return new Response(JSON.stringify({ error: 'Eintrag nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const DELETE: APIRoute = async ({ params, request }) => {
  const planId = params.id
  if (!planId) {
    return new Response(JSON.stringify({ error: 'Plan-ID fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const plan = await getPlanById(planId)
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (plan.isArchived) {
    return new Response(
      JSON.stringify({
        error: 'Plan ist archiviert - keine Änderungen möglich',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
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

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const deleted = await deleteManualEntry(parsed.data.entryId)
  if (!deleted) {
    return new Response(JSON.stringify({ error: 'Eintrag nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
