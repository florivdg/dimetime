import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteTransaction,
  getTransactionWithPlanStatus,
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
  const { id } = params
  if (!id) return error('Transaktions-ID ist erforderlich', 400)

  const existing = await getTransactionWithPlanStatus(id)
  if (!existing) return error('Transaktion nicht gefunden', 404)

  if (existing.planIsArchived) {
    return error(
      'Transaktion kann nicht bearbeitet werden, da der zugehörige Plan archiviert ist.',
      403,
    )
  }

  const data = await validateBody(request, updateTransactionSchema)
  if (data instanceof Response) return data

  const planError = await validateTransactionPlanChange(
    existing.planId,
    data.planId,
    getPlanById,
  )
  if (planError) return error(planError.message, planError.status)

  const updated = await updateTransaction(id, data)
  return json(updated)
}

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params
  if (!id) return error('Transaktions-ID ist erforderlich', 400)

  const existing = await getTransactionWithPlanStatus(id)
  if (!existing) return error('Transaktion nicht gefunden', 404)

  if (existing.planIsArchived) {
    return error(
      'Transaktion kann nicht gelöscht werden, da der zugehörige Plan archiviert ist.',
      403,
    )
  }

  await deleteTransaction(id)
  return json({ success: true, message: 'Transaktion wurde gelöscht' })
}
