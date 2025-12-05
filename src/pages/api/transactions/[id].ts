import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteTransaction,
  getTransactionById,
  updateTransaction,
} from '@/lib/transactions'

const updateTransactionSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(200, 'Name ist zu lang')
    .optional(),
  note: z.string().max(2000, 'Notiz ist zu lang').nullable().optional(),
  type: z.enum(['income', 'expense']).optional(),
  dueDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Ungültiges Datumsformat (erwartet: JJJJ-MM-TT)',
    )
    .optional(),
  amount: z.number().int().min(0, 'Betrag muss positiv sein').optional(),
  isDone: z.boolean().optional(),
  categoryId: z.string().uuid().nullable().optional(),
})

export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Transaktions-ID ist erforderlich' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const existing = await getTransactionById(id)
  if (!existing) {
    return new Response(
      JSON.stringify({ error: 'Transaktion nicht gefunden' }),
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

  const parsed = updateTransactionSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const updated = await updateTransaction(id, parsed.data)

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Transaktions-ID ist erforderlich' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const existing = await getTransactionById(id)
  if (!existing) {
    return new Response(
      JSON.stringify({ error: 'Transaktion nicht gefunden' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  await deleteTransaction(id)

  return new Response(
    JSON.stringify({ success: true, message: 'Transaktion wurde gelöscht' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
