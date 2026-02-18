import type { APIRoute } from 'astro'
import { commitBankImport } from '@/lib/bank-import/service'
import {
  asImportApiError,
  jsonError,
  jsonResponse,
  parseImportFormData,
} from '@/lib/bank-import/api-helpers'

export const POST: APIRoute = async ({ request, locals }) => {
  const parsed = await parseImportFormData(request)
  if (parsed instanceof Response) return parsed

  try {
    const result = await commitBankImport({
      sourceId: parsed.sourceId,
      file: parsed.file,
      triggeredByUserId: locals.user?.id ?? null,
    })
    return jsonResponse(result)
  } catch (error) {
    const mapped = asImportApiError(error)
    return jsonError(mapped.message, mapped.status)
  }
}
