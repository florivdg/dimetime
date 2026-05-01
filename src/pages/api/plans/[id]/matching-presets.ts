import type { APIRoute } from 'astro'
import { getPlanById } from '@/lib/plans'
import { getPresetsWithMatchStatus } from '@/lib/presets'
import {
  handle,
  json,
  requireExisting,
  requireUserId,
} from '@/lib/api/responses'

export const GET: APIRoute = async ({ params, locals }) => {
  const userId = requireUserId(locals)
  if (userId instanceof Response) return userId

  const found = await requireExisting(
    params,
    'id',
    'Plan-ID',
    getPlanById,
    'Plan nicht gefunden',
  )
  if (found instanceof Response) return found

  const planMonth = found.resource.date.substring(0, 7)

  return handle(
    async () =>
      json({ presets: await getPresetsWithMatchStatus(userId, planMonth) }),
    'Fehler beim Laden der Vorlagen',
    'Error fetching matching presets',
  )
}
