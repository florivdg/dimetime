import type { APIRoute } from 'astro'
import { z } from 'zod'
import { runKassensturzAutoReconcile } from '@/lib/kassensturz-auto-match'
import { json, parseJson, requirePlan } from './_helpers'

const autoReconcileSchema = z.object({
  dryRun: z.boolean().optional().default(false),
})

export const POST: APIRoute = async ({ params, request, locals }) => {
  const planResult = await requirePlan(params.id, { writable: true })
  if ('response' in planResult) {
    return planResult.response
  }

  const parsedResult = await parseJson(request, autoReconcileSchema)
  if ('response' in parsedResult) {
    return parsedResult.response
  }

  try {
    const result = await runKassensturzAutoReconcile({
      planId: planResult.planId,
      dryRun: parsedResult.data.dryRun,
      matchedByUserId: locals.user?.id ?? null,
    })

    return json(200, result)
  } catch (error) {
    console.error('Kassensturz Auto-Zuordnung fehlgeschlagen:', error)
    return json(500, {
      error:
        error instanceof Error
          ? error.message
          : 'Auto-Zuordnung konnte nicht ausgeführt werden',
    })
  }
}
