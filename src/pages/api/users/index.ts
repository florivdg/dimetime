import type { APIRoute } from 'astro'
import { getAllUsers } from '@/lib/users'

export const GET: APIRoute = async () => {
  const users = await getAllUsers()

  return new Response(JSON.stringify({ users }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
