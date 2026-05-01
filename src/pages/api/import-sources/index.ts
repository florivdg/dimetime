import type { APIRoute } from 'astro'
import { createImportSource, getImportSources } from '@/lib/bank-transactions'
import { handle, json, parseJson, validate } from '@/lib/api/responses'
import { createSourceSchema } from './_schema'

export const GET: APIRoute = async () => {
  const sources = await getImportSources()
  return json({ sources })
}

export const POST: APIRoute = async ({ request }) => {
  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(createSourceSchema, body)
  if (data instanceof Response) return data

  return handle(
    async () => json(await createImportSource(data), 201),
    'Import-Quelle konnte nicht erstellt werden',
  )
}
