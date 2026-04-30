import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createPreset, getPresets } from '@/lib/presets'
import {
  error,
  json,
  parseJson,
  unauthorized,
  validate,
} from '@/lib/api/responses'

const querySchema = z.object({
  search: z.string().optional(),
  type: z.enum(['income', 'expense']).optional(),
  categoryId: z.uuid().optional(),
  recurrence: z
    .enum(['einmalig', 'monatlich', 'vierteljährlich', 'jährlich'])
    .optional(),
  includeExpired: z
    .string()
    .transform((v) => v === 'true')
    .optional()
    .default(true),
  sortBy: z
    .enum(['name', 'createdAt', 'lastUsedAt', 'amount'])
    .optional()
    .default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce
    .number()
    .refine((v) => v === -1 || (v >= 1 && v <= 100), {
      message: 'Limit muss -1 (unbegrenzt) oder zwischen 1 und 100 sein',
    })
    .optional()
    .default(20),
})

const createSchema = z.object({
  name: z.string().min(1).max(200),
  note: z.string().max(2000).nullable().optional(),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.number().int().min(0),
  recurrence: z
    .enum(['einmalig', 'monatlich', 'vierteljährlich', 'jährlich'])
    .optional(),
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  categoryId: z.uuid().nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  isBudget: z.boolean().optional(),
})

export const GET: APIRoute = async ({ url, locals }) => {
  const userId = locals.user?.id
  if (!userId) return unauthorized()

  const rawParams = {
    search: url.searchParams.get('search') || undefined,
    type: url.searchParams.get('type') || undefined,
    categoryId: url.searchParams.get('categoryId') || undefined,
    recurrence: url.searchParams.get('recurrence') || undefined,
    includeExpired: url.searchParams.get('includeExpired') || undefined,
    sortBy: url.searchParams.get('sortBy') || undefined,
    sortDir: url.searchParams.get('sortDir') || undefined,
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
  }

  const data = validate(querySchema, rawParams)
  if (data instanceof Response) return data

  try {
    const result = await getPresets(userId, data)
    return json(result)
  } catch (err) {
    console.error('Error fetching presets:', err)
    return error(
      err instanceof Error ? err.message : 'Fehler beim Laden der Vorlagen',
      500,
    )
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = locals.user?.id
  if (!userId) return unauthorized()

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(createSchema, body)
  if (data instanceof Response) return data

  try {
    const preset = await createPreset(userId, data)
    return json(preset, 201)
  } catch (err) {
    console.error('Error creating preset:', err)
    return error(
      err instanceof Error ? err.message : 'Fehler beim Erstellen der Vorlage',
      500,
    )
  }
}
