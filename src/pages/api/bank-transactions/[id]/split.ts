import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getBankTransactionById } from '@/lib/bank-transactions'
import {
  splitBankTransaction,
  unsplitBankTransaction,
} from '@/lib/bank-transaction-splits'

const splitSchema = z.object({
  splits: z
    .array(
      z.object({
        amountCents: z.number().int(),
        label: z.string().max(200).optional(),
      }),
    )
    .min(2)
    .max(20),
})

export const POST: APIRoute = async ({ params, request }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Transaktions-ID ist erforderlich' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const existing = await getBankTransactionById(id)
  if (!existing) {
    return new Response(
      JSON.stringify({ error: 'Banktransaktion nicht gefunden' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
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

  const parsed = splitSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const splits = await splitBankTransaction(id, parsed.data.splits)
    return new Response(JSON.stringify({ success: true, splits }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fehler beim Aufteilen'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Transaktions-ID ist erforderlich' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    await unsplitBankTransaction(id)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Fehler beim Aufheben der Teilung'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
