import type { APIRoute } from 'astro'
import {
  completeInstallmentPlan,
  findInstallmentPlan,
} from '@/lib/installments'
import { error, handle, json, requireExisting } from '@/lib/api/responses'

const notFound = 'Ratenzahlung nicht gefunden'

export const POST: APIRoute = async ({ params }) => {
  const found = await requireExisting(
    params,
    'id',
    'Ratenzahlungs-ID',
    findInstallmentPlan,
    notFound,
  )
  if (found instanceof Response) return found

  if (found.resource.completedAt) {
    return error('Ratenzahlung ist bereits abgelöst', 409)
  }

  return handle(
    async () => {
      const completed = await completeInstallmentPlan(found.id)
      if (!completed) return error(notFound, 404)
      // The client discards the body and refreshes via /api/installments/overview
      return json(completed)
    },
    'Fehler beim Ablösen der Ratenzahlung',
    'Error completing installment plan',
  )
}
