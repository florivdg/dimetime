import type { APIRoute } from 'astro'
import { getBudgetSpendingForPlan } from '@/lib/transactions'
import { error, json } from '@/lib/api/responses'

export const GET: APIRoute = async ({ params }) => {
  const { id } = params
  if (!id) return error('Plan-ID fehlt', 400)

  const spending = await getBudgetSpendingForPlan(id)
  return json({ spending })
}
