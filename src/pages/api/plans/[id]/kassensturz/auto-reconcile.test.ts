import { beforeEach, describe, expect, it, mock } from 'bun:test'

let getPlanByIdImpl: (id: string) => Promise<unknown>
let runKassensturzAutoReconcileImpl: (input: {
  planId: string
  dryRun?: boolean
  matchedByUserId?: string | null
}) => Promise<unknown>
let runCalls = 0

void mock.module('@/lib/plans', () => ({
  getPlanById: (id: string) => getPlanByIdImpl(id),
}))

void mock.module('@/lib/kassensturz-auto-match', () => ({
  runKassensturzAutoReconcile: (input: {
    planId: string
    dryRun?: boolean
    matchedByUserId?: string | null
  }) => {
    runCalls += 1
    return runKassensturzAutoReconcileImpl(input)
  },
}))

const { POST } = await import('./auto-reconcile')

function buildRequest(body: string): Request {
  return new Request(
    'http://localhost/api/plans/plan-1/kassensturz/auto-reconcile',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  )
}

beforeEach(() => {
  getPlanByIdImpl = async () => ({ id: 'plan-1', isArchived: false })
  runCalls = 0
  runKassensturzAutoReconcileImpl = async () => ({
    stats: {
      processed: 1,
      matched: 1,
      suggested: 0,
      skippedAmbiguous: 0,
      skippedNoCandidate: 0,
    },
    applied: [],
    suggestions: [],
  })
})

describe('POST /api/plans/[id]/kassensturz/auto-reconcile', () => {
  it('returns 403 for archived plans', async () => {
    getPlanByIdImpl = async () => ({ id: 'plan-1', isArchived: true })

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest(JSON.stringify({ dryRun: false })),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(403)
    expect(runCalls).toBe(0)
  })

  it('returns 400 for invalid json', async () => {
    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('{'),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(400)
    expect(runCalls).toBe(0)
  })

  it('forwards dryRun and user context', async () => {
    runKassensturzAutoReconcileImpl = async (input) => {
      expect(input.planId).toBe('plan-1')
      expect(input.dryRun).toBe(true)
      expect(input.matchedByUserId).toBe('user-42')
      return {
        stats: {
          processed: 3,
          matched: 1,
          suggested: 1,
          skippedAmbiguous: 0,
          skippedNoCandidate: 1,
        },
        applied: [],
        suggestions: [],
      }
    }

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest(JSON.stringify({ dryRun: true })),
      locals: { user: { id: 'user-42' } },
    } as never)

    expect(response.status).toBe(200)
    expect(runCalls).toBe(1)
  })
})
