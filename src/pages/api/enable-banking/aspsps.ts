import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  asImportApiError,
  jsonError,
  jsonResponse,
} from '@/lib/bank-import/api-helpers'
import { isEnableBankingConfigured } from '@/lib/enable-banking/config'
import { listAspsps } from '@/lib/enable-banking/service'

const querySchema = z.object({
  country: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  psuType: z.enum(['personal', 'business']).optional(),
})

export const GET: APIRoute = async ({ url }) => {
  if (!isEnableBankingConfigured()) {
    return jsonError('Enable Banking ist nicht konfiguriert.', 503)
  }
  const parsed = querySchema.safeParse({
    country: url.searchParams.get('country') ?? undefined,
    psuType: url.searchParams.get('psu_type') ?? undefined,
  })
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? 'Ungültige Anfrage',
      400,
    )
  }

  try {
    const response = await listAspsps({
      country: parsed.data.country,
      psuType: parsed.data.psuType,
      service: 'AIS',
    })
    return jsonResponse(response)
  } catch (error) {
    const mapped = asImportApiError(error)
    return jsonError(mapped.message, mapped.status)
  }
}
