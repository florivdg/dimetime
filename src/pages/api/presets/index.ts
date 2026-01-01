import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createPreset, getPresets } from '@/lib/presets'

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
})

export const GET: APIRoute = async ({ url, locals }) => {
  const userId = locals.user?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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

  const parsed = querySchema.safeParse(rawParams)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const result = await getPresets(userId, parsed.data)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching presets:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Laden der Vorlagen',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = locals.user?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiger Request-Body' }), {
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

  try {
    const preset = await createPreset(userId, parsed.data)
    return new Response(JSON.stringify(preset), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error creating preset:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Erstellen der Vorlage',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
