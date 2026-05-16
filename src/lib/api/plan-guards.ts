import { getPlanById, type Plan } from '@/lib/plans'
import { error } from '@/lib/api/responses'
import { orDefault } from '@/lib/defaults'

export interface PlanGuardMessages {
  notFound?: string
  archived?: string
  archivedStatus?: number
}

export async function requireUnarchivedPlan(
  planId: string,
  messages: PlanGuardMessages = {},
): Promise<Plan | Response> {
  const notFoundMsg = orDefault(messages.notFound, 'Plan nicht gefunden')
  const archivedMsg = orDefault(messages.archived, 'Plan ist archiviert')
  const archivedStatus = orDefault(messages.archivedStatus, 400)

  const plan = await getPlanById(planId)
  if (!plan) return error(notFoundMsg, 404)
  if (plan.isArchived) return error(archivedMsg, archivedStatus)
  return plan
}
