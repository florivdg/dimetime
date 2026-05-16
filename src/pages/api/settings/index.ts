import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getAllSettings, updateSettings } from '@/lib/settings'
import { error, json, validateBody } from '@/lib/api/responses'

const updateSettingsSchema = z.object({
  groupTransactionsByType: z.boolean().optional(),
  themePreference: z.enum(['light', 'dark', 'system']).optional(),
})

export const GET: APIRoute = async ({ locals }) => {
  const userId = locals.user?.id
  if (!userId) return error('Nicht autorisiert', 401)

  const settings = await getAllSettings(userId)
  return json(settings)
}

export const PUT: APIRoute = async ({ request, locals }) => {
  const userId = locals.user?.id
  if (!userId) return error('Nicht autorisiert', 401)

  const data = await validateBody(request, updateSettingsSchema)
  if (data instanceof Response) return data

  await updateSettings(userId, data)
  const updated = await getAllSettings(userId)
  return json(updated)
}
