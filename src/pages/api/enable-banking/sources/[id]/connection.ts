import type { APIRoute } from 'astro'
import {
  asImportApiError,
  jsonError,
  jsonResponse,
} from '@/lib/bank-import/api-helpers'
import { isEnableBankingConfigured } from '@/lib/enable-banking/config'
import { disconnectSource } from '@/lib/enable-banking/service'

export const DELETE: APIRoute = async ({ params }) => {
  if (!isEnableBankingConfigured()) {
    return jsonError('Enable Banking ist nicht konfiguriert.', 503)
  }
  const id = params.id
  if (!id) return jsonError('Quellen-ID fehlt.', 400)

  try {
    const result = await disconnectSource(id)
    return jsonResponse({
      ok: true,
      disconnectedCount: result.disconnectedCount,
    })
  } catch (error) {
    const mapped = asImportApiError(error)
    return jsonError(mapped.message, mapped.status)
  }
}
