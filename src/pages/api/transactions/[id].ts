import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteTransaction,
  requireUnarchivedTransaction,
  updateTransaction,
  validateTransactionPlanChange,
} from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'
import { error, json, validateBody } from '@/lib/api/responses'

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
  isBudget: z.boolean().optional(),
  categoryId: z.uuid().nullable().optional(),
  planId: z.uuid().optional(),
})

export const PUT: APIRoute = async ({ params, request }) => {
  const existing = await requireUnarchivedTransaction(params.id, 'bearbeitet')
  if (existing instanceof Response) return existing

  const data = await validateBody(request, updateTransactionSchema)
  if (data instanceof Response) return data

  const planError = await validateTransactionPlanChange(
    existing.planId,
    data.planId,
    getPlanById,
  )
  if (planError) return error(planError.message, planError.status)

  const updated = await updateTransaction(existing.id, data)
  return json(updated)
}

export const DELETE: APIRoute = async ({ params }) => {
  const existing = await requireUnarchivedTransaction(params.id, 'gelöscht')
  if (existing instanceof Response) return existing

  await deleteTransaction(existing.id)
  return json({ success: true, message: 'Transaktion wurde gelöscht' })
}
