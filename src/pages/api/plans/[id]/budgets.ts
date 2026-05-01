import type { APIRoute } from 'astro'
import { getBudgetsForPlan } from '@/lib/transactions'
import { getPlanById } from '@/lib/plans'
import { json, requireExisting } from '@/lib/api/responses'

// fallow-ignore-next-line code-duplication
export const GET: APIRoute = async ({ params }) => {
  const found = await requireExisting(
    params,
    'id',
    'Plan-ID',
    getPlanById,
    'Plan nicht gefunden',
  )
  if (found instanceof Response) return found

  return json({ budgets: await getBudgetsForPlan(found.id) })
}
