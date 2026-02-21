import { beforeEach, describe, expect, it, mock } from 'bun:test'

let getPlanByIdImpl: (id: string) => Promise<unknown>
let getBankTransactionInPlanImpl: (
  planId: string,
  bankTransactionId: string,
) => Promise<unknown>
let getDismissalByBankTransactionInPlanImpl: (
  planId: string,
  bankTransactionId: string,
) => Promise<unknown>
let dismissBankTransactionImpl: (input: {
  bankTransactionId: string
  planId: string
  reason?: string | null
  userId?: string | null
}) => Promise<unknown>
let undismissBankTransactionImpl: (
  planId: string,
  dismissalId: string,
) => Promise<unknown>

async function unexpectedCall() {
  throw new Error('Unexpected mock call')
}

void mock.module('@/lib/plans', () => ({
  getPlanById: (id: string) => getPlanByIdImpl(id),
}))

void mock.module('@/lib/kassensturz', () => ({
  getPlannedTransactionInPlan: unexpectedCall,
  removeReconciliation: unexpectedCall,
  getBankTransactionInPlan: (planId: string, bankTransactionId: string) =>
    getBankTransactionInPlanImpl(planId, bankTransactionId),
  getDismissalByBankTransactionInPlan: (
    planId: string,
    bankTransactionId: string,
  ) => getDismissalByBankTransactionInPlanImpl(planId, bankTransactionId),
  dismissBankTransaction: (input: {
    bankTransactionId: string
    planId: string
    reason?: string | null
    userId?: string | null
  }) => dismissBankTransactionImpl(input),
  undismissBankTransaction: (planId: string, dismissalId: string) =>
    undismissBankTransactionImpl(planId, dismissalId),
  createManualEntry: unexpectedCall,
  updateManualEntry: unexpectedCall,
  deleteManualEntry: unexpectedCall,
}))

const { POST, DELETE } = await import('./dismiss')

function buildRequest(method: 'POST' | 'DELETE', body: unknown): Request {
  return new Request('http://localhost/api/plans/plan-1/kassensturz/dismiss', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  getPlanByIdImpl = async () => ({ id: 'plan-1', isArchived: false })
  getBankTransactionInPlanImpl = async () => ({ id: 'bank-1' })
  getDismissalByBankTransactionInPlanImpl = async () => undefined
  dismissBankTransactionImpl = async () => ({ id: 'dismissal-1' })
  undismissBankTransactionImpl = async () => ({ id: 'dismissal-1' })
})

describe('POST /api/plans/[id]/kassensturz/dismiss', () => {
  it('returns 404 when bank transaction is outside plan scope', async () => {
    getBankTransactionInPlanImpl = async () => undefined

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('POST', { bankTransactionId: crypto.randomUUID() }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(404)
  })

  it('returns 409 when transaction is already dismissed', async () => {
    getDismissalByBankTransactionInPlanImpl = async () => ({
      id: 'dismissal-1',
    })

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('POST', { bankTransactionId: crypto.randomUUID() }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(409)
  })

  it('returns 403 for archived plans', async () => {
    getPlanByIdImpl = async () => ({ id: 'plan-1', isArchived: true })

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('POST', { bankTransactionId: crypto.randomUUID() }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(403)
  })
})

describe('DELETE /api/plans/[id]/kassensturz/dismiss', () => {
  it('returns 404 when dismissal is outside plan scope', async () => {
    undismissBankTransactionImpl = async () => undefined

    const response = await DELETE({
      params: { id: 'plan-1' },
      request: buildRequest('DELETE', { dismissalId: crypto.randomUUID() }),
      locals: {},
    } as never)

    expect(response.status).toBe(404)
  })
})
