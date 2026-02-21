import { getPlanById } from '@/lib/plans'
import type { Plan } from '@/lib/plans'
import { z } from 'zod'

export function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type PlanCheckResult = { planId: string; plan: Plan } | { response: Response }

export async function requirePlan(
  paramsId: string | undefined,
  options: { writable?: boolean } = {},
): Promise<PlanCheckResult> {
  if (!paramsId) {
    return { response: json(400, { error: 'Plan-ID fehlt' }) }
  }

  const plan = await getPlanById(paramsId)
  if (!plan) {
    return { response: json(404, { error: 'Plan nicht gefunden' }) }
  }

  if (options.writable && plan.isArchived) {
    return {
      response: json(403, {
        error: 'Plan ist archiviert - keine Änderungen möglich',
      }),
    }
  }

  return { planId: paramsId, plan }
}

type ParsedJsonResult<TSchema extends z.ZodTypeAny> =
  | { data: z.infer<TSchema> }
  | { response: Response }

export async function parseJson<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<ParsedJsonResult<TSchema>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { response: json(400, { error: 'Ungültiges JSON' }) }
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return {
      response: json(400, {
        error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe',
      }),
    }
  }

  return { data: parsed.data }
}
