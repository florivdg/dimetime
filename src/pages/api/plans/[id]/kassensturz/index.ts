import type { APIRoute } from 'astro'
import { getKassensturzData } from '@/lib/kassensturz'
import { json, requirePlan } from './_helpers'

export const GET: APIRoute = async ({ params }) => {
  const planResult = await requirePlan(params.id)
  if ('response' in planResult) {
    return planResult.response
  }

  const { planId } = planResult

  const data = await getKassensturzData(planId)

  return json(200, data)
}
