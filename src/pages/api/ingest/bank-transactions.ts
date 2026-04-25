import type { APIRoute } from 'astro'
import { z } from 'zod'
import { upsertNormalizedBankTransactions } from '@/lib/bank-import/service'
import {
  normalizeCurrency,
  normalizeOptionalCurrency,
} from '@/lib/bank-import/normalize'
import {
  asImportApiError,
  jsonError,
  jsonResponse,
} from '@/lib/bank-import/api-helpers'
import type { NormalizedBankTransactionInput } from '@/lib/bank-import/types'

const MAX_BODY_BYTES = 1024 * 1024
const MAX_RAW_DATA_FIELDS = 50
const MAX_RAW_DATA_KEY_LENGTH = 100
const MAX_RAW_DATA_VALUE_LENGTH = 2000

const currencySchema = z.string().regex(/^[A-Za-z]{3}$/)
const rawDataSchema = z
  .record(
    z.string().min(1).max(MAX_RAW_DATA_KEY_LENGTH),
    z.string().max(MAX_RAW_DATA_VALUE_LENGTH).nullable(),
  )
  .refine((value) => Object.keys(value).length <= MAX_RAW_DATA_FIELDS, {
    message: `rawData darf maximal ${MAX_RAW_DATA_FIELDS} Felder enthalten`,
  })

const rowSchema = z.object({
  externalTransactionId: z.string().max(200).nullable().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  amountCents: z.number().int(),
  currency: currencySchema.default('EUR'),
  counterparty: z.string().max(500).nullable().optional(),
  bookingText: z.string().max(500).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  purpose: z.string().max(2000).nullable().optional(),
  status: z.enum(['booked', 'pending', 'unknown']).default('unknown'),
  balanceAfterCents: z.number().int().nullable().optional(),
  balanceCurrency: currencySchema.nullable().optional(),
  country: z.string().max(10).nullable().optional(),
  cardLast4: z.string().max(10).nullable().optional(),
  cardholder: z.string().max(200).nullable().optional(),
  originalAmountCents: z.number().int().nullable().optional(),
  originalCurrency: currencySchema.nullable().optional(),
  rawData: rawDataSchema.optional(),
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
    currency: normalizeCurrency(row.currency),
    originalAmountCents: row.originalAmountCents ?? null,
    originalCurrency: normalizeOptionalCurrency(row.originalCurrency),
    counterparty: row.counterparty ?? null,
    bookingText: row.bookingText ?? null,
    description: row.description ?? null,
    purpose: row.purpose ?? null,
    status: row.status,
    balanceAfterCents: row.balanceAfterCents ?? null,
    balanceCurrency: normalizeOptionalCurrency(row.balanceCurrency),
    country: row.country ?? null,
    cardLast4: row.cardLast4 ?? null,
    cardholder: row.cardholder ?? null,
    rawData: row.rawData ?? {},
  }
}

async function readRequestJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const tooLarge = {
    ok: false as const,
    response: jsonError('JSON-Body ist zu groß', 413),
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return tooLarge
  }

  const reader = request.body?.getReader()
  if (!reader) {
    return { ok: false, response: jsonError('Ungültiger JSON-Body', 400) }
  }

  let size = 0
  const decoder = new TextDecoder()
  let text = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        return tooLarge
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return { ok: true, body: JSON.parse(text) }
  } catch {
    return { ok: false, response: jsonError('Ungültiger JSON-Body', 400) }
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const apiKey = locals.apiKey
  if (!apiKey) {
    return jsonError('Nicht autorisiert', 401)
  }

  const bodyResult = await readRequestJson(request)
  if (!bodyResult.ok) return bodyResult.response

  const parsed = ingestSchema.safeParse(bodyResult.body)
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
