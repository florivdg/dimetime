import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createTransaction, getTransactions } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'
import { getSetting } from '@/lib/settings'

const querySchema = z.object({
  search: z.string().optional(),
  categoryId: z.uuid().optional(),
  planId: z.uuid().optional(),
  type: z.enum(['income', 'expense']).optional(),
  isDone: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  amountMin: z.coerce.number().min(0).optional(),
  amountMax: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['name', 'dueDate', 'categoryName', 'amount']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce
    .number()
    .refine((v) => v === -1 || (v >= 1 && v <= 100), {
      message: 'Limit must be -1 (unlimited) or between 1 and 100',
    })
    .optional()
    .default(20),
})

const createSchema = z.object({
  name: z.string().min(1).max(200),
  note: z.string().max(2000).nullable().optional(),
  type: z.enum(['income', 'expense']).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int().min(0),
  isDone: z.boolean().optional(),
  planId: z.uuid(),
  categoryId: z.uuid().nullable().optional(),
})

export const GET: APIRoute = async ({ url, locals }) => {
  const rawParams = {
    search: url.searchParams.get('search') || undefined,
    categoryId: url.searchParams.get('categoryId') || undefined,
    planId: url.searchParams.get('planId') || undefined,
    type: url.searchParams.get('type') || undefined,
    isDone: url.searchParams.get('isDone') || undefined,
    dateFrom: url.searchParams.get('dateFrom') || undefined,
    dateTo: url.searchParams.get('dateTo') || undefined,
    amountMin: url.searchParams.get('amountMin') || undefined,
    amountMax: url.searchParams.get('amountMax') || undefined,
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

  const userId = locals.user?.id
  const groupByType = userId
    ? await getSetting(userId, 'groupTransactionsByType')
    : false

  const result = await getTransactions({
    ...parsed.data,
    groupByType,
  })

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Check if the target plan exists and is not archived
  const targetPlan = await getPlanById(parsed.data.planId)
  if (!targetPlan) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (targetPlan.isArchived) {
    return new Response(
      JSON.stringify({
        error:
          'Transaktionen können nicht zu einem archivierten Plan hinzugefügt werden.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const transaction = await createTransaction(parsed.data)
    return new Response(JSON.stringify(transaction), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Failed to create transaction:', error)
    return new Response(
      JSON.stringify({ error: 'Transaktion konnte nicht erstellt werden' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
