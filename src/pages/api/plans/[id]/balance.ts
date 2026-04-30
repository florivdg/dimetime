import type { APIRoute } from 'astro'
import { getPlanBalance } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'
import { error, json } from '@/lib/api/responses'

export const GET: APIRoute = async ({ params }) => {
  const { id } = params
  if (!id) return error('Plan-ID fehlt', 400)

  const plan = await getPlanById(id)
  if (!plan) return error('Plan nicht gefunden', 404)

  const balance = await getPlanBalance(id)
  return json(balance)
}
