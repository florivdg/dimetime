import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  BudgetLinksConfirmationRequiredError,
  deleteTransaction,
  requireUnarchivedTransaction,
  updateTransaction,
  validateTransactionPlanChange,
} from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'
import {
  recordInstallmentSkip,
  syncPlansForInstallment,
} from '@/lib/installments'
import { monthOfPlanDate } from '@/lib/dates'
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
  confirmClearBudgetLinks: z.boolean().optional(),
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
    existing.installmentId,
  )
  if (planError) return error(planError.message, planError.status)

  try {
    const updated = await updateTransaction(existing.id, data)
    return json(updated)
  } catch (err) {
    // Discarding budget assignments needs an explicit opt-in; the payload's
    // `code` keeps this apart from the installment 409 above
    if (err instanceof BudgetLinksConfirmationRequiredError) {
      return json(err.toPayload(), 409)
    }
    throw err
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  const existing = await requireUnarchivedTransaction(params.id, 'gelöscht')
  if (existing instanceof Response) return existing

  const deleted = await deleteTransaction(existing.id)
  // Tombstone the month only once the row is really gone — a skip for a row
  // that still exists would block the month forever
  const installmentId = deleted ? existing.installmentId : null

  if (installmentId) {
    await recordInstallmentSkip(
      installmentId,
      monthOfPlanDate(existing.planDate ?? existing.dueDate),
    )
    // The remaining count is unchanged, so the rate shifts into a later plan
    await syncPlansForInstallment(installmentId)
  }

  return json({
    success: true,
    message: 'Transaktion wurde gelöscht',
    installmentSkipped: installmentId !== null,
  })
}
