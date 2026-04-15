import type { APIRoute } from 'astro'
import {
  asImportApiError,
  jsonError,
  jsonResponse,
} from '@/lib/bank-import/api-helpers'
import { isEnableBankingConfigured } from '@/lib/enable-banking/config'
import { syncAllEnableBankingSources } from '@/lib/enable-banking/service'

export const POST: APIRoute = async ({ locals }) => {
  if (!isEnableBankingConfigured()) {
    return jsonError('Enable Banking ist nicht konfiguriert.', 503)
  }
  try {
    const result = await syncAllEnableBankingSources({
      triggeredByUserId: locals.user?.id ?? null,
    })
    return jsonResponse(result)
  } catch (error) {
    const mapped = asImportApiError(error)
    return jsonError(mapped.message, mapped.status)
  }
}
