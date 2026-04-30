import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteBankTransaction,
  getBankTransactionById,
  updateBankTransactionFields,
} from '@/lib/bank-transactions'
import { error, json, parseJson, validate } from '@/lib/api/responses'
import { getPlanById } from '@/lib/plans'
import { getTransactionById } from '@/lib/transactions'

const patchSchema = z
  .object({
    planId: z.uuid().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
    budgetId: z.uuid().nullable().optional(),
  })
  .refine(
    (data) =>
      data.planId !== undefined ||
      data.note !== undefined ||
      data.budgetId !== undefined,
    {
      message:
        'Mindestens ein Feld (planId, note oder budgetId) muss angegeben werden.',
    },
  )

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id
  if (!id) return error('Transaktions-ID ist erforderlich', 400)

  const existing = await getBankTransactionById(id)
  if (!existing) return error('Banktransaktion nicht gefunden', 404)

  await deleteBankTransaction(id)
  return json({ success: true, message: 'Banktransaktion wurde gelöscht' })
}

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id
  if (!id) return error('Transaktions-ID ist erforderlich', 400)

  const existing = await getBankTransactionById(id)
  if (!existing) return error('Banktransaktion nicht gefunden', 404)

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(patchSchema, body)
  if (data instanceof Response) return data

  if (data.planId !== undefined && data.planId) {
    const targetPlan = await getPlanById(data.planId)
    if (!targetPlan) return error('Zielplan nicht gefunden', 404)
    if (targetPlan.isArchived) {
      return error(
        'Banktransaktionen können nicht einem archivierten Plan zugeordnet werden.',
        400,
      )
    }
  }

  if (data.budgetId !== undefined && data.budgetId !== null) {
    const budget = await getTransactionById(data.budgetId)
    if (!budget) return error('Budget nicht gefunden', 404)
    if (!budget.isBudget) return error('Transaktion ist kein Budget', 400)

    const effectivePlanId =
      data.planId !== undefined ? data.planId : existing.planId
    if (budget.planId !== effectivePlanId) {
      return error('Budget gehört nicht zum zugewiesenen Plan', 400)
    }
  }

  const updated = await updateBankTransactionFields(id, {
    ...(data.planId !== undefined && { planId: data.planId }),
    ...(data.note !== undefined && { note: data.note }),
    ...(data.budgetId !== undefined && { budgetId: data.budgetId }),
  })

  return json(updated)
}
