import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getBankTransactionById } from '@/lib/bank-transactions'
import {
  splitBankTransaction,
  unsplitBankTransaction,
} from '@/lib/bank-transaction-splits'
import { jsonError, jsonResponse } from '@/lib/bank-import/api-helpers'

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
  if (!id) return jsonError('Transaktions-ID ist erforderlich')

  const existing = await getBankTransactionById(id)
  if (!existing) return jsonError('Banktransaktion nicht gefunden', 404)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Ungültiges JSON')
  }

  const parsed = splitSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe')
  }

  try {
    const splits = await splitBankTransaction(id, parsed.data.splits)
    return jsonResponse({ success: true, splits })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fehler beim Aufteilen'
    return jsonError(message)
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id
  if (!id) return jsonError('Transaktions-ID ist erforderlich')

  const existing = await getBankTransactionById(id)
  if (!existing) return jsonError('Banktransaktion nicht gefunden', 404)

  try {
    await unsplitBankTransaction(id)
    return jsonResponse({ success: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Fehler beim Aufheben der Teilung'
    return jsonError(message)
  }
}
