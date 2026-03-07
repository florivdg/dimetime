import type { APIRoute } from 'astro'
import { getBudgetSpendingForPlan } from '@/lib/transactions'

export const GET: APIRoute = async ({ params }) => {
  const { id } = params

  if (!id) {
    return new Response(JSON.stringify({ error: 'Plan-ID fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const spending = await getBudgetSpendingForPlan(id)

  return new Response(JSON.stringify({ spending }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
