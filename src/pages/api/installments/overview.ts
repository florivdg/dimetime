import type { APIRoute } from 'astro'
import { getInstallmentOverview } from '@/lib/installments'
import { currentMonth } from '@/lib/dates'
import { handle, json } from '@/lib/api/responses'

export const GET: APIRoute = async () =>
  handle(
    async () => json(await getInstallmentOverview(currentMonth())),
    'Fehler beim Laden der Ratenzahlungen',
    'Error fetching installment overview',
  )
