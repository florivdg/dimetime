import type { APIRoute } from 'astro'
import { z } from 'zod'
import { deletePlan, getPlanById, updatePlan } from '@/lib/plans'
import { error, json, parseJson, validate } from '@/lib/api/responses'

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
  if (!id) return error('Plan-ID ist erforderlich', 400)

  const existing = await getPlanById(id)
  if (!existing) return error('Plan nicht gefunden', 404)

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(updatePlanSchema, body)
  if (data instanceof Response) return data

  const updated = await updatePlan(id, data)
  return json(updated)
}

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params
  if (!id) return error('Plan-ID ist erforderlich', 400)

  const existing = await getPlanById(id)
  if (!existing) return error('Plan nicht gefunden', 404)

  await deletePlan(id)
  return json({ success: true, message: 'Plan wurde gelöscht' })
}
