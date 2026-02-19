import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getBankTransactions } from '@/lib/bank-transactions'

const querySchema = z.object({
  sourceId: z.uuid().optional(),
  planId: z.uuid().optional(),
  status: z.enum(['booked', 'pending', 'unknown']).optional(),
  search: z.string().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sortBy: z.enum(['bookingDate', 'amountCents', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce
    .number()
    .refine((value) => value === -1 || (value >= 1 && value <= 100), {
      message: 'Limit muss -1 (unbegrenzt) oder zwischen 1 und 100 sein',
    })
    .optional()
    .default(20),
})

export const GET: APIRoute = async ({ url }) => {
  const rawParams = {
    sourceId: url.searchParams.get('sourceId') || undefined,
    planId: url.searchParams.get('planId') || undefined,
    status: url.searchParams.get('status') || undefined,
    search: url.searchParams.get('search') || undefined,
    dateFrom: url.searchParams.get('dateFrom') || undefined,
    dateTo: url.searchParams.get('dateTo') || undefined,
    sortBy: url.searchParams.get('sortBy') || undefined,
    sortDir: url.searchParams.get('sortDir') || undefined,
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
  }

  const parsed = querySchema.safeParse(rawParams)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Filter',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = await getBankTransactions(parsed.data)
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
