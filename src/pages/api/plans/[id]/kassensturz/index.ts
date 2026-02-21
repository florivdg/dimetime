import type { APIRoute } from 'astro'
import { getPlanById } from '@/lib/plans'
import { getKassensturzData } from '@/lib/kassensturz'

export const GET: APIRoute = async ({ params }) => {
  const planId = params.id
  if (!planId) {
    return new Response(JSON.stringify({ error: 'Plan-ID fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const plan = await getPlanById(planId)
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = await getKassensturzData(planId)

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
