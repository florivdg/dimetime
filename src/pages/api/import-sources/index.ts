import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createImportSource, getImportSources } from '@/lib/bank-transactions'

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
  return new Response(JSON.stringify({ sources }), {
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

  const parsed = createSourceSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const source = await createImportSource(parsed.data)
    return new Response(JSON.stringify(source), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Import-Quelle konnte nicht erstellt werden:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Import-Quelle konnte nicht erstellt werden',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
