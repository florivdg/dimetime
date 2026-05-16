import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getBankTransactions } from '@/lib/bank-transactions'
import { paginationFields, sortDirField } from '@/lib/api/pagination-schema'
import { parseQueryParams } from '@/lib/api/query-params'
import { json, validate } from '@/lib/api/responses'

const BANK_TRANSACTION_QUERY_KEYS = [
  'sourceId',
  'planId',
  'status',
  'search',
  'dateFrom',
  'dateTo',
  'showArchived',
  'sortBy',
  'sortDir',
  'page',
  'limit',
] as const

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
  showArchived: z.coerce.boolean().optional(),
  sortBy: z.enum(['bookingDate', 'amountCents', 'createdAt']).optional(),
  sortDir: sortDirField,
  ...paginationFields,
})

export const GET: APIRoute = async ({ url }) => {
  const rawParams = parseQueryParams(
    url.searchParams,
    BANK_TRANSACTION_QUERY_KEYS,
  )
  const data = validate(querySchema, rawParams)
  if (data instanceof Response) return data
  return json(await getBankTransactions(data))
}
