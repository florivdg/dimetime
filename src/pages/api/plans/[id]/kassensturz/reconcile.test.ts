import { beforeEach, describe, expect, it, mock } from 'bun:test'

type SafeResult =
  | { status: 'created'; reconciliation: Record<string, unknown> }
  | { status: 'bank_conflict'; reconciliation: Record<string, unknown> }

let getPlanByIdImpl: (id: string) => Promise<unknown>
let getBankTransactionInPlanImpl: (
  planId: string,
  bankTransactionId: string,
) => Promise<unknown>
let getPlannedTransactionInPlanImpl: (
  planId: string,
  plannedTransactionId: string,
) => Promise<unknown>
let removeReconciliationImpl: (
  planId: string,
  reconciliationId: string,
) => Promise<unknown>
let createManualReconciliationSafelyImpl: (input: {
  bankTransactionId: string
  plannedTransactionId: string
  matchedByUserId?: string | null
}) => Promise<SafeResult>
let createManualReconciliationSafelyCalls = 0
let learnFromManualReconciliationCalls = 0
let learnFromManualReconciliationImpl: (input: {
  planId: string
  bankTransactionId: string
  plannedTransactionId: string
}) => Promise<unknown>

async function unexpectedCall() {
  throw new Error('Unexpected mock call')
}

void mock.module('@/lib/plans', () => ({
  getPlanById: (id: string) => getPlanByIdImpl(id),
}))

void mock.module('@/lib/kassensturz', () => ({
  getBankTransactionInPlan: (planId: string, bankTransactionId: string) =>
    getBankTransactionInPlanImpl(planId, bankTransactionId),
  getPlannedTransactionInPlan: (planId: string, plannedTransactionId: string) =>
    getPlannedTransactionInPlanImpl(planId, plannedTransactionId),
  removeReconciliation: (planId: string, reconciliationId: string) =>
    removeReconciliationImpl(planId, reconciliationId),
  dismissBankTransaction: unexpectedCall,
  getDismissalByBankTransactionInPlan: unexpectedCall,
  undismissBankTransaction: unexpectedCall,
  createManualEntry: unexpectedCall,
  updateManualEntry: unexpectedCall,
  deleteManualEntry: unexpectedCall,
}))

void mock.module('@/lib/bank-transactions', () => ({
  createManualReconciliationSafely: (input: {
    bankTransactionId: string
    plannedTransactionId: string
    matchedByUserId?: string | null
  }) => {
    createManualReconciliationSafelyCalls += 1
    return createManualReconciliationSafelyImpl(input)
  },
}))

void mock.module('@/lib/kassensturz-learning', () => ({
  learnFromManualReconciliation: (input: {
    planId: string
    bankTransactionId: string
    plannedTransactionId: string
  }) => {
    learnFromManualReconciliationCalls += 1
    return learnFromManualReconciliationImpl(input)
  },
}))

const { POST, DELETE } = await import('./reconcile')

function buildRequest(method: 'POST' | 'DELETE', body: unknown): Request {
  return new Request(
    'http://localhost/api/plans/plan-1/kassensturz/reconcile',
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

beforeEach(() => {
  getPlanByIdImpl = async () => ({ id: 'plan-1', isArchived: false })
  getBankTransactionInPlanImpl = async () => ({ id: 'bank-1' })
  getPlannedTransactionInPlanImpl = async () => ({ id: 'planned-1' })
  removeReconciliationImpl = async () => ({ id: 'rec-1' })
  createManualReconciliationSafelyCalls = 0
  learnFromManualReconciliationCalls = 0
  learnFromManualReconciliationImpl = async () => ({ id: 'rule-1' })
  createManualReconciliationSafelyImpl = async () => ({
    status: 'created',
    reconciliation: { id: 'rec-1' },
  })
})

describe('POST /api/plans/[id]/kassensturz/reconcile', () => {
  it('returns 404 when bank transaction is outside plan scope', async () => {
    getBankTransactionInPlanImpl = async () => undefined

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('POST', {
        bankTransactionId: crypto.randomUUID(),
        plannedTransactionId: crypto.randomUUID(),
      }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(404)
    expect(createManualReconciliationSafelyCalls).toBe(0)
  })

  it('returns 404 when planned transaction is outside plan scope', async () => {
    getPlannedTransactionInPlanImpl = async () => undefined

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('POST', {
        bankTransactionId: crypto.randomUUID(),
        plannedTransactionId: crypto.randomUUID(),
      }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(404)
    expect(createManualReconciliationSafelyCalls).toBe(0)
  })

  it('returns 403 for archived plans', async () => {
    getPlanByIdImpl = async () => ({ id: 'plan-1', isArchived: true })

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('POST', {
        bankTransactionId: crypto.randomUUID(),
        plannedTransactionId: crypto.randomUUID(),
      }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(403)
  })

  it('learns from successful manual reconciliation', async () => {
    const bankTransactionId = crypto.randomUUID()
    const plannedTransactionId = crypto.randomUUID()

    learnFromManualReconciliationImpl = async (input) => {
      expect(input.planId).toBe('plan-1')
      expect(input.bankTransactionId).toBe(bankTransactionId)
      expect(input.plannedTransactionId).toBe(plannedTransactionId)
      return { id: 'rule-1' }
    }

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('POST', {
        bankTransactionId,
        plannedTransactionId,
      }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(201)
    expect(learnFromManualReconciliationCalls).toBe(1)
  })
})

describe('DELETE /api/plans/[id]/kassensturz/reconcile', () => {
  it('returns 404 when reconciliation is outside plan scope', async () => {
    removeReconciliationImpl = async () => undefined

    const response = await DELETE({
      params: { id: 'plan-1' },
      request: buildRequest('DELETE', {
        reconciliationId: crypto.randomUUID(),
      }),
      locals: {},
    } as never)

    expect(response.status).toBe(404)
  })
})
