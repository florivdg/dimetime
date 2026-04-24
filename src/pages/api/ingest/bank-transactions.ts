import type { APIRoute } from 'astro'
import { z } from 'zod'
import { upsertNormalizedBankTransactions } from '@/lib/bank-import/service'
import {
  asImportApiError,
  jsonError,
  jsonResponse,
} from '@/lib/bank-import/api-helpers'
import type { NormalizedBankTransactionInput } from '@/lib/bank-import/types'

const rowSchema = z.object({
  externalTransactionId: z.string().max(200).nullable().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  amountCents: z.number().int(),
  currency: z.string().length(3).default('EUR'),
  counterparty: z.string().max(500).nullable().optional(),
  bookingText: z.string().max(500).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  purpose: z.string().max(2000).nullable().optional(),
  status: z.enum(['booked', 'pending', 'unknown']).default('unknown'),
  balanceAfterCents: z.number().int().nullable().optional(),
  balanceCurrency: z.string().length(3).nullable().optional(),
  country: z.string().max(10).nullable().optional(),
  cardLast4: z.string().max(10).nullable().optional(),
  cardholder: z.string().max(200).nullable().optional(),
  originalAmountCents: z.number().int().nullable().optional(),
  originalCurrency: z.string().length(3).nullable().optional(),
  rawData: z.record(z.string(), z.string().nullable()).optional(),
})

const ingestSchema = z.object({
  sourceId: z.uuid(),
  rows: z.array(rowSchema).min(1).max(500),
})

function normalizeRow(
  row: z.infer<typeof rowSchema>,
): NormalizedBankTransactionInput {
  return {
    externalTransactionId: row.externalTransactionId ?? null,
    bookingDate: row.bookingDate,
    valueDate: row.valueDate ?? null,
    amountCents: row.amountCents,
    currency: row.currency,
    originalAmountCents: row.originalAmountCents ?? null,
    originalCurrency: row.originalCurrency ?? null,
    counterparty: row.counterparty ?? null,
    bookingText: row.bookingText ?? null,
    description: row.description ?? null,
    purpose: row.purpose ?? null,
    status: row.status,
    balanceAfterCents: row.balanceAfterCents ?? null,
    balanceCurrency: row.balanceCurrency ?? null,
    country: row.country ?? null,
    cardLast4: row.cardLast4 ?? null,
    cardholder: row.cardholder ?? null,
    rawData: row.rawData ?? {},
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const apiKey = locals.apiKey
  if (!apiKey) {
    return jsonError('Nicht autorisiert', 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Ungültiger JSON-Body', 400)
  }

  const parsed = ingestSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      400,
    )
  }

  try {
    const result = await upsertNormalizedBankTransactions({
      sourceId: parsed.data.sourceId,
      rows: parsed.data.rows.map(normalizeRow),
      triggeredByUserId: apiKey.referenceId,
    })
    return jsonResponse(result)
  } catch (error) {
    const mapped = asImportApiError(error)
    return jsonError(mapped.message, mapped.status)
  }
}
