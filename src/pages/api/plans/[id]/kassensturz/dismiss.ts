import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getPlanById } from '@/lib/plans'
import {
  dismissBankTransaction,
  undismissBankTransaction,
} from '@/lib/kassensturz'

const dismissSchema = z.object({
  bankTransactionId: z.uuid(),
  reason: z.string().optional(),
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

  const parsed = dismissSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const dismissal = await dismissBankTransaction({
      bankTransactionId: parsed.data.bankTransactionId,
      planId,
      reason: parsed.data.reason ?? null,
      userId: locals.user?.id ?? null,
    })

    return new Response(JSON.stringify(dismissal), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Kassensturz Verwerfung fehlgeschlagen:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Transaktion konnte nicht verworfen werden',
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

  const parsed = z.object({ dismissalId: z.uuid() }).safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const deleted = await undismissBankTransaction(parsed.data.dismissalId)
  if (!deleted) {
    return new Response(
      JSON.stringify({ error: 'Verwerfung nicht gefunden' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
