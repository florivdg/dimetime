import type { APIRoute } from 'astro'
import { z } from 'zod'
import { deletePlan, getPlanById, updatePlan } from '@/lib/plans'

const updatePlanSchema = z.object({
  name: z.string().max(200, 'Name ist zu lang').nullable().optional(),
  date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Ungültiges Datumsformat (erwartet: JJJJ-MM-TT)',
    )
    .optional(),
  notes: z.string().max(2000, 'Notizen sind zu lang').nullable().optional(),
  isArchived: z.boolean().optional(),
})

export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params

  if (!id) {
    return new Response(JSON.stringify({ error: 'Plan-ID ist erforderlich' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const existing = await getPlanById(id)
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = updatePlanSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const updated = await updatePlan(id, parsed.data)

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params

  if (!id) {
    return new Response(JSON.stringify({ error: 'Plan-ID ist erforderlich' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const existing = await getPlanById(id)
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Plan nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await deletePlan(id)

  return new Response(
    JSON.stringify({ success: true, message: 'Plan wurde gelöscht' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
