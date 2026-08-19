import type { APIRoute } from 'astro'
import {
  deleteInstallmentPlan,
  findInstallmentPlan,
  updateInstallmentPlan,
} from '@/lib/installments'
import {
  error,
  handle,
  json,
  requireExisting,
  validateBody,
} from '@/lib/api/responses'
import {
  PREPAID_MESSAGE,
  updateInstallmentSchema,
} from '@/lib/installments-schema'

const notFound = 'Ratenzahlung nicht gefunden'

const findInstallment = (params: Record<string, string | undefined>) =>
  requireExisting(
    params,
    'id',
    'Ratenzahlungs-ID',
    findInstallmentPlan,
    notFound,
  )

export const PUT: APIRoute = async ({ params, request }) => {
  const found = await findInstallment(params)
  if (found instanceof Response) return found

  const data = await validateBody(request, updateInstallmentSchema)
  if (data instanceof Response) return data

  // A partial update may carry only one of the two fields, so the merged values
  // are checked against the stored ones
  const prepaid = data.prepaidInstallments ?? found.resource.prepaidInstallments
  const total = data.totalInstallments ?? found.resource.totalInstallments
  if (prepaid > total) return error(PREPAID_MESSAGE, 400)

  return handle(
    async () => {
      // Repricing the open rows and re-syncing the plans happens in the lib
      const updated = await updateInstallmentPlan(found.id, data)
      if (!updated) return error(notFound, 404)
      // The client discards the body and refreshes via /api/installments/overview
      return json(updated)
    },
    'Fehler beim Aktualisieren der Ratenzahlung',
    'Error updating installment plan',
  )
}

export const DELETE: APIRoute = async ({ params }) => {
  const found = await findInstallment(params)
  if (found instanceof Response) return found

  return handle(
    async () => {
      const success = await deleteInstallmentPlan(found.id)
      if (!success) return error(notFound, 404)
      return json({ success: true, message: 'Ratenzahlung wurde gelöscht' })
    },
    'Fehler beim Löschen der Ratenzahlung',
    'Error deleting installment plan',
  )
}
