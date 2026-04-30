import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createImportSource, getImportSources } from '@/lib/bank-transactions'
import { error, json, parseJson, validate } from '@/lib/api/responses'

const createSourceSchema = z.object({
  name: z.string().min(1).max(200),
  preset: z.enum(['ing_csv_v1', 'easybank_xlsx_v1']),
  sourceKind: z.enum(['bank_account', 'credit_card', 'other']),
  bankName: z.string().max(200).nullable().optional(),
  accountLabel: z.string().max(200).nullable().optional(),
  accountIdentifier: z.string().max(200).nullable().optional(),
  defaultPlanAssignment: z.enum(['auto_month', 'none']).optional(),
  isActive: z.boolean().optional(),
})

export const GET: APIRoute = async () => {
  const sources = await getImportSources()
  return json({ sources })
}

export const POST: APIRoute = async ({ request }) => {
  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(createSourceSchema, body)
  if (data instanceof Response) return data

  try {
    const source = await createImportSource(data)
    return json(source, 201)
  } catch (err) {
    console.error('Import-Quelle konnte nicht erstellt werden:', err)
    return error(
      err instanceof Error
        ? err.message
        : 'Import-Quelle konnte nicht erstellt werden',
      500,
    )
  }
}
