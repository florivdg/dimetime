import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  createTransaction,
  getBudgetSpendingForBudgets,
  getTransactions,
  parseTransactionQueryParams,
} from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'
import { getSetting } from '@/lib/settings'
import { error, json, validate, validateBody } from '@/lib/api/responses'

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
  hideZeroValue: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
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
  isBudget: z.boolean().optional(),
  planId: z.uuid(),
  categoryId: z.uuid().nullable().optional(),
})

// fallow-ignore-next-line complexity
export const GET: APIRoute = async ({ url, locals }) => {
  const data = validate(
    querySchema,
    parseTransactionQueryParams(url.searchParams),
  )
  if (data instanceof Response) return data

  const userId = locals.user?.id
  const groupByType = userId
    ? await getSetting(userId, 'groupTransactionsByType')
    : false

  const result = await getTransactions({
    ...data,
    groupByType,
  })

  const budgetIds = result.transactions
    .filter((t) => t.isBudget)
    .map((t) => t.id)
  const budgetSpending =
    budgetIds.length > 0 ? await getBudgetSpendingForBudgets(budgetIds) : {}

  return json({ ...result, budgetSpending })
}

export const POST: APIRoute = async ({ request }) => {
  const data = await validateBody(request, createSchema)
  if (data instanceof Response) return data

  const targetPlan = await getPlanById(data.planId)
  if (!targetPlan) return error('Plan nicht gefunden', 404)

  if (targetPlan.isArchived) {
    return error(
      'Transaktionen können nicht zu einem archivierten Plan hinzugefügt werden.',
      403,
    )
  }

  try {
    const transaction = await createTransaction(data)
    return json(transaction, 201)
  } catch (err) {
    console.error('Failed to create transaction:', err)
    return error('Transaktion konnte nicht erstellt werden', 500)
  }
}
