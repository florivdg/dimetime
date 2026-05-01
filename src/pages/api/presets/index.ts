import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createPreset, getPresets } from '@/lib/presets'
import {
  handle,
  json,
  requireUserId,
  validate,
  validateBody,
} from '@/lib/api/responses'
import { parseQueryParams } from '@/lib/api/query-params'
import { createPresetSchema } from './_schema'

const PRESET_QUERY_KEYS = [
  'search',
  'type',
  'categoryId',
  'recurrence',
  'includeExpired',
  'sortBy',
  'sortDir',
  'page',
  'limit',
] as const

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

export const GET: APIRoute = async ({ url, locals }) => {
  const userId = requireUserId(locals)
  if (userId instanceof Response) return userId

  const rawParams = parseQueryParams(url.searchParams, PRESET_QUERY_KEYS)

  const data = validate(querySchema, rawParams)
  if (data instanceof Response) return data

  return handle(
    async () => json(await getPresets(userId, data)),
    'Fehler beim Laden der Vorlagen',
    'Error fetching presets',
  )
}

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = requireUserId(locals)
  if (userId instanceof Response) return userId

  const data = await validateBody(request, createPresetSchema)
  if (data instanceof Response) return data

  return handle(
    async () => json(await createPreset(userId, data), 201),
    'Fehler beim Erstellen der Vorlage',
    'Error creating preset',
  )
}
