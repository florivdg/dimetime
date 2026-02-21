import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getPlanById } from '@/lib/plans'
import { removeReconciliation } from '@/lib/kassensturz'
import { createManualReconciliationSafely } from '@/lib/bank-transactions'

const reconcileSchema = z.object({
  bankTransactionId: z.uuid(),
  plannedTransactionId: z.uuid(),
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

  const parsed = reconcileSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const result = await createManualReconciliationSafely({
      bankTransactionId: parsed.data.bankTransactionId,
      plannedTransactionId: parsed.data.plannedTransactionId,
      matchedByUserId: locals.user?.id ?? null,
    })

    if (result.status === 'created') {
      return new Response(JSON.stringify(result.reconciliation), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // result.status === 'bank_conflict'
    return new Response(
      JSON.stringify({
        error: 'Diese Banktransaktion wurde bereits abgeglichen.',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Kassensturz Zuordnung fehlgeschlagen:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Zuordnung konnte nicht erstellt werden',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
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

  const parsed = z.object({ reconciliationId: z.uuid() }).safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const deleted = await removeReconciliation(parsed.data.reconciliationId)
  if (!deleted) {
    return new Response(JSON.stringify({ error: 'Zuordnung nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
