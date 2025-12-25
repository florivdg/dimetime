import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteTransaction,
  getTransactionWithPlanStatus,
  updateTransaction,
} from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'

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
  categoryId: z.uuid().nullable().optional(),
  planId: z.uuid().optional(),
})

export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Transaktions-ID ist erforderlich' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const existing = await getTransactionWithPlanStatus(id)
  if (!existing) {
    return new Response(
      JSON.stringify({ error: 'Transaktion nicht gefunden' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Reject if plan is archived
  if (existing.planIsArchived) {
    return new Response(
      JSON.stringify({
        error:
          'Transaktion kann nicht bearbeitet werden, da der zugehörige Plan archiviert ist.',
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

  const parsed = updateTransactionSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Validate target plan if moving to a different plan
  if (parsed.data.planId) {
    if (parsed.data.planId === existing.planId) {
      return new Response(
        JSON.stringify({ error: 'Transaktion ist bereits in diesem Plan' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const targetPlan = await getPlanById(parsed.data.planId)
    if (!targetPlan) {
      return new Response(
        JSON.stringify({ error: 'Zielplan nicht gefunden' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (targetPlan.isArchived) {
      return new Response(
        JSON.stringify({
          error:
            'Transaktion kann nicht zu einem archivierten Plan verschoben werden',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
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

  const existing = await getTransactionWithPlanStatus(id)
  if (!existing) {
    return new Response(
      JSON.stringify({ error: 'Transaktion nicht gefunden' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Reject if plan is archived
  if (existing.planIsArchived) {
    return new Response(
      JSON.stringify({
        error:
          'Transaktion kann nicht gelöscht werden, da der zugehörige Plan archiviert ist.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  await deleteTransaction(id)

  return new Response(
    JSON.stringify({ success: true, message: 'Transaktion wurde gelöscht' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
