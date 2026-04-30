import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createPlan, getAllPlans, searchPlans } from '@/lib/plans'
import { json, parseJson, validate } from '@/lib/api/responses'

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
  const yearParam = url.searchParams.get('year')

  const year =
    yearParam === 'all' || !yearParam ? undefined : parseInt(yearParam, 10)

  const plans = search
    ? await searchPlans(search, includeArchived, year)
    : await getAllPlans(includeArchived, year)

  return json({ plans })
}

export const POST: APIRoute = async ({ request }) => {
  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(createPlanSchema, body)
  if (data instanceof Response) return data

  const plan = await createPlan(data)
  return json(plan, 201)
}
