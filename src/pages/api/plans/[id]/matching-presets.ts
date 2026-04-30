import type { APIRoute } from 'astro'
import { getPlanById } from '@/lib/plans'
import { getPresetsWithMatchStatus } from '@/lib/presets'
import { error, json, unauthorized } from '@/lib/api/responses'

export const GET: APIRoute = async ({ params, locals }) => {
  const userId = locals.user?.id
  if (!userId) return unauthorized()

  const { id } = params
  if (!id) return error('Fehlende Plan-ID', 400)

  const plan = await getPlanById(id)
  if (!plan) return error('Plan nicht gefunden', 404)

  const planMonth = plan.date.substring(0, 7)

  try {
    const presets = await getPresetsWithMatchStatus(userId, planMonth)
    return json({ presets })
  } catch (err) {
    console.error('Error fetching matching presets:', err)
    return error(
      err instanceof Error ? err.message : 'Fehler beim Laden der Vorlagen',
      500,
    )
  }
}
