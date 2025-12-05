import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createPlan, getAllPlans, searchPlans } from '@/lib/plans'

const createPlanSchema = z.object({
  name: z.string().max(200, 'Name ist zu lang').nullable().optional(),
  date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Ungültiges Datumsformat (erwartet: JJJJ-MM-TT)',
    ),
  notes: z.string().max(2000, 'Notizen sind zu lang').nullable().optional(),
  isArchived: z.boolean().optional(),
})

export const GET: APIRoute = async ({ url }) => {
  const search = url.searchParams.get('search')
  const includeArchived = url.searchParams.get('includeArchived') === 'true'

  const plans = search
    ? await searchPlans(search, includeArchived)
    : await getAllPlans(includeArchived)

  return new Response(JSON.stringify({ plans }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = createPlanSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const plan = await createPlan(parsed.data)

  return new Response(JSON.stringify(plan), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
