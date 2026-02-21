import { beforeEach, describe, expect, it, mock } from 'bun:test'

let getPlanByIdImpl: (id: string) => Promise<unknown>
let getPlannedTransactionInPlanImpl: (
  planId: string,
  plannedTransactionId: string,
) => Promise<unknown>
let createManualEntryImpl: (input: {
  planId: string
  name: string
  note?: string | null
  amountCents: number
  type: 'income' | 'expense'
  plannedTransactionId?: string | null
  userId?: string | null
}) => Promise<unknown>
let updateManualEntryImpl: (
  planId: string,
  id: string,
  input: {
    name?: string
    note?: string | null
    amountCents?: number
    type?: 'income' | 'expense'
    plannedTransactionId?: string | null
  },
) => Promise<unknown>
let deleteManualEntryImpl: (planId: string, id: string) => Promise<unknown>

async function unexpectedCall() {
  throw new Error('Unexpected mock call')
}

void mock.module('@/lib/plans', () => ({
  getPlanById: (id: string) => getPlanByIdImpl(id),
}))

void mock.module('@/lib/kassensturz', () => ({
  getBankTransactionInPlan: unexpectedCall,
  removeReconciliation: unexpectedCall,
  dismissBankTransaction: unexpectedCall,
  getDismissalByBankTransactionInPlan: unexpectedCall,
  undismissBankTransaction: unexpectedCall,
  getPlannedTransactionInPlan: (planId: string, plannedTransactionId: string) =>
    getPlannedTransactionInPlanImpl(planId, plannedTransactionId),
  createManualEntry: (input: {
    planId: string
    name: string
    note?: string | null
    amountCents: number
    type: 'income' | 'expense'
    plannedTransactionId?: string | null
    userId?: string | null
  }) => createManualEntryImpl(input),
  updateManualEntry: (
    planId: string,
    id: string,
    input: {
      name?: string
      note?: string | null
      amountCents?: number
      type?: 'income' | 'expense'
      plannedTransactionId?: string | null
    },
  ) => updateManualEntryImpl(planId, id, input),
  deleteManualEntry: (planId: string, id: string) =>
    deleteManualEntryImpl(planId, id),
}))

const { POST, PUT, DELETE } = await import('./manual-entries')

function buildRequest(
  method: 'POST' | 'PUT' | 'DELETE',
  body: unknown,
): Request {
  return new Request(
    'http://localhost/api/plans/plan-1/kassensturz/manual-entries',
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

beforeEach(() => {
  getPlanByIdImpl = async () => ({ id: 'plan-1', isArchived: false })
  getPlannedTransactionInPlanImpl = async () => ({ id: 'planned-1' })
  createManualEntryImpl = async () => ({ id: 'entry-1' })
  updateManualEntryImpl = async () => ({ id: 'entry-1' })
  deleteManualEntryImpl = async () => ({ id: 'entry-1' })
})

describe('POST /api/plans/[id]/kassensturz/manual-entries', () => {
  it('returns 404 when planned transaction is outside plan scope', async () => {
    getPlannedTransactionInPlanImpl = async () => undefined

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('POST', {
        name: 'Bar',
        amountCents: 100,
        type: 'income',
        plannedTransactionId: crypto.randomUUID(),
      }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(404)
  })

  it('returns 403 for archived plans', async () => {
    getPlanByIdImpl = async () => ({ id: 'plan-1', isArchived: true })

    const response = await POST({
      params: { id: 'plan-1' },
      request: buildRequest('POST', {
        name: 'Bar',
        amountCents: 100,
        type: 'income',
      }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(403)
  })
})

describe('PUT /api/plans/[id]/kassensturz/manual-entries', () => {
  it('returns 404 when entry is outside plan scope', async () => {
    updateManualEntryImpl = async () => undefined

    const response = await PUT({
      params: { id: 'plan-1' },
      request: buildRequest('PUT', {
        entryId: crypto.randomUUID(),
        name: 'Neu',
      }),
      locals: {},
    } as never)

    expect(response.status).toBe(404)
  })
})

describe('DELETE /api/plans/[id]/kassensturz/manual-entries', () => {
  it('returns 404 when entry is outside plan scope', async () => {
    deleteManualEntryImpl = async () => undefined

    const response = await DELETE({
      params: { id: 'plan-1' },
      request: buildRequest('DELETE', {
        entryId: crypto.randomUUID(),
      }),
      locals: {},
    } as never)

    expect(response.status).toBe(404)
  })
})
