import type { APIRoute } from 'astro'
import { createInstallmentPlan } from '@/lib/installments'
import {
  handle,
  json,
  requireUserId,
  unwrap,
  validateBody,
} from '@/lib/api/responses'
import { createInstallmentSchema } from '@/lib/installments-schema'

export const POST: APIRoute = async ({ request, locals }) =>
  handle(
    async () => {
      const userId = unwrap(requireUserId(locals))
      const data = unwrap(await validateBody(request, createInstallmentSchema))
      // Creating already materializes the installment into every eligible plan
      const created = await createInstallmentPlan(data, userId)
      // The client discards the body and refreshes via /api/installments/overview
      return json(created, 201)
    },
    'Fehler beim Erstellen der Ratenzahlung',
    'Error creating installment plan',
  )
