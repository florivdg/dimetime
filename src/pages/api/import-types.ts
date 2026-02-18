import type { APIRoute } from 'astro'
import { getImportTypes } from '@/lib/bank-import/service'

export const GET: APIRoute = async () => {
  const importTypes = getImportTypes()
  return new Response(JSON.stringify({ importTypes }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
