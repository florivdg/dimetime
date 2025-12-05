import type { APIRoute } from 'astro'
import { getDashboardStats } from '@/lib/dashboard'

export const GET: APIRoute = async () => {
  const stats = await getDashboardStats()

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
