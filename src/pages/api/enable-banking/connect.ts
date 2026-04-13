import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  asImportApiError,
  jsonError,
  jsonResponse,
} from '@/lib/bank-import/api-helpers'
import {
  EB_STATE_COOKIE,
  isEnableBankingConfigured,
} from '@/lib/enable-banking/config'
import { startConnect } from '@/lib/enable-banking/service'

const bodySchema = z.object({
  aspspName: z.string().min(1).max(200),
  aspspCountry: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase()),
  psuType: z.enum(['personal', 'business']).optional(),
})

export const POST: APIRoute = async ({ request, cookies, url }) => {
  if (!isEnableBankingConfigured()) {
    return jsonError('Enable Banking ist nicht konfiguriert.', 503)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Ungültiges JSON', 400)
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      400,
    )
  }

  const state = crypto.randomUUID()
  cookies.set(EB_STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 10 * 60,
  })

  try {
    const result = await startConnect({
      aspspName: parsed.data.aspspName,
      aspspCountry: parsed.data.aspspCountry,
      psuType: parsed.data.psuType,
      state,
    })
    return jsonResponse({ redirectUrl: result.redirectUrl })
  } catch (error) {
    const mapped = asImportApiError(error)
    return jsonError(mapped.message, mapped.status)
  }
}
