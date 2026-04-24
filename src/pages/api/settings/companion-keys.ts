import type { APIRoute } from 'astro'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import {
  COMPANION_KEY_PREFIX,
  companionKeyPermissions,
} from '@/lib/companion-api'
import { jsonError, jsonResponse } from '@/lib/bank-import/api-helpers'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  expiresIn: z.number().int().positive().nullable().optional(),
})

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = locals.user?.id
  if (!userId) {
    return jsonError('Nicht autorisiert', 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Ungültiger JSON-Body', 400)
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      400,
    )
  }

  try {
    const created = await auth.api.createApiKey({
      body: {
        name: parsed.data.name,
        expiresIn: parsed.data.expiresIn ?? null,
        userId,
        prefix: COMPANION_KEY_PREFIX,
        permissions: companionKeyPermissions(),
      },
    })

    return jsonResponse(
      {
        id: created.id,
        name: created.name,
        start: created.start,
        prefix: created.prefix,
        key: created.key,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
      },
      201,
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'API-Key konnte nicht erstellt werden'
    return jsonError(message, 500)
  }
}
