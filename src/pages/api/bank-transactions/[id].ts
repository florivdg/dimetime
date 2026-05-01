import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteBankTransaction,
  getBankTransactionById,
  updateBankTransactionFields,
  validateBankTransactionPatch,
} from '@/lib/bank-transactions'
import { error, json, validateBody } from '@/lib/api/responses'
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

// fallow-ignore-next-line complexity
export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id
  if (!id) return error('Transaktions-ID ist erforderlich', 400)

  const existing = await getBankTransactionById(id)
  if (!existing) return error('Banktransaktion nicht gefunden', 404)

  const data = await validateBody(request, patchSchema)
  if (data instanceof Response) return data

  const validationError = await validateBankTransactionPatch(
    data,
    existing,
    getPlanById,
    getTransactionById,
  )
  if (validationError)
    return error(validationError.message, validationError.status)

  const updated = await updateBankTransactionFields(id, data)
  return json(updated)
}
