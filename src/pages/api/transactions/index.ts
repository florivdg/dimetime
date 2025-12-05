import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getTransactions } from '@/lib/transactions'

const querySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'dueDate', 'categoryName', 'amount']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
})

export const GET: APIRoute = async ({ url }) => {
  const rawParams = {
    search: url.searchParams.get('search') || undefined,
    categoryId: url.searchParams.get('categoryId') || undefined,
    planId: url.searchParams.get('planId') || undefined,
    sortBy: url.searchParams.get('sortBy') || undefined,
    sortDir: url.searchParams.get('sortDir') || undefined,
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
  }

  const parsed = querySchema.safeParse(rawParams)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = await getTransactions(parsed.data)

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
