import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  createManualReconciliationSafely,
  getBankTransactionById,
  getPlannedTransactionById,
} from '@/lib/bank-transactions'

const reconcileSchema = z.object({
  plannedTransactionId: z.uuid(),
})

export const POST: APIRoute = async ({ params, request, locals }) => {
  const bankTransactionId = params.id
  if (!bankTransactionId) {
    return new Response(
      JSON.stringify({ error: 'Banktransaktions-ID fehlt' }),
      {
        status: 400,
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

  const parsed = reconcileSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const [bankTx, plannedTx] = await Promise.all([
    getBankTransactionById(bankTransactionId),
    getPlannedTransactionById(parsed.data.plannedTransactionId),
  ])

  if (!bankTx) {
    return new Response(
      JSON.stringify({ error: 'Banktransaktion nicht gefunden' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  if (!plannedTx) {
    return new Response(
      JSON.stringify({ error: 'Geplante Transaktion nicht gefunden' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const result = await createManualReconciliationSafely({
      bankTransactionId,
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
    console.error('Reconciliation fehlgeschlagen:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Abgleich konnte nicht erstellt werden',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
