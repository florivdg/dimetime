import type { APIRoute } from 'astro'
import { getBudgetsForPlan } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'

export const GET: APIRoute = async ({ params }) => {
  const { id } = params

  if (!id) {
    return new Response(JSON.stringify({ error: 'Plan-ID fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const plan = await getPlanById(id)
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const budgets = await getBudgetsForPlan(id)

  return new Response(JSON.stringify({ budgets }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
