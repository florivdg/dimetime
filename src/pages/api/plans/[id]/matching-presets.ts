import type { APIRoute } from 'astro'
import { getPlanById } from '@/lib/plans'
import { getPresetsWithMatchStatus } from '@/lib/presets'

export const GET: APIRoute = async ({ params, locals }) => {
  const userId = locals.user?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = params
  if (!id) {
    return new Response(JSON.stringify({ error: 'Fehlende Plan-ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const plan = await getPlanById(id)
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const planMonth = plan.date.substring(0, 7) // YYYY-MM from YYYY-MM-DD

  try {
    const presets = await getPresetsWithMatchStatus(userId, planMonth)
    return new Response(JSON.stringify({ presets }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching matching presets:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Laden der Vorlagen',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
