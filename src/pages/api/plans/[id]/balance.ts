import type { APIRoute } from 'astro'
import { getPlanBalance } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'

export const GET: APIRoute = async ({ params }) => {
  const { id } = params

  if (!id) {
    return new Response(JSON.stringify({ error: 'Plan-ID fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify plan exists
  const plan = await getPlanById(id)
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const balance = await getPlanBalance(id)

  return new Response(JSON.stringify(balance), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
