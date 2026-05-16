import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  createTransaction,
  getBudgetSpendingForBudgets,
  getTransactions,
  parseTransactionQueryParams,
} from '@/lib/transactions'
import { getSetting } from '@/lib/settings'
import {
  handle,
  json,
  unwrap,
  validate,
  validateBody,
} from '@/lib/api/responses'
import { requireUnarchivedPlan } from '@/lib/api/plan-guards'
import { paginationFields, sortDirField } from '@/lib/api/pagination-schema'

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
  sortDir: sortDirField,
  ...paginationFields,
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

export const POST: APIRoute = async ({ request }) =>
  handle(
    async () => {
      const data = unwrap(await validateBody(request, createSchema))
      unwrap(
        await requireUnarchivedPlan(data.planId, {
          archived:
            'Transaktionen können nicht zu einem archivierten Plan hinzugefügt werden.',
          archivedStatus: 403,
        }),
      )
      return json(await createTransaction(data), 201)
    },
    'Transaktion konnte nicht erstellt werden',
    'Failed to create transaction',
  )
