import { beforeEach, describe, expect, it, mock } from 'bun:test'

type SafeResult =
  | { status: 'created'; reconciliation: Record<string, unknown> }
  | { status: 'bank_conflict'; reconciliation: Record<string, unknown> }
  | { status: 'planned_conflict'; reconciliation: Record<string, unknown> }

let getBankTransactionByIdImpl: (id: string) => Promise<unknown>
let getPlannedTransactionByIdImpl: (id: string) => Promise<unknown>
let createManualReconciliationSafelyImpl: (input: {
  bankTransactionId: string
  plannedTransactionId: string
  matchedByUserId?: string | null
}) => Promise<SafeResult>

void mock.module('@/lib/bank-transactions', () => ({
  getBankTransactionById: (id: string) => getBankTransactionByIdImpl(id),
  getPlannedTransactionById: (id: string) => getPlannedTransactionByIdImpl(id),
  createManualReconciliationSafely: (input: {
    bankTransactionId: string
    plannedTransactionId: string
    matchedByUserId?: string | null
  }) => createManualReconciliationSafelyImpl(input),
}))

const { POST } = await import('./[id]/reconcile')

function buildRequest(body: unknown): Request {
  return new Request(
    'http://localhost/api/bank-transactions/bank-1/reconcile',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

beforeEach(() => {
  getBankTransactionByIdImpl = async () => ({ id: 'bank-1' })
  getPlannedTransactionByIdImpl = async () => ({ id: 'plan-1' })
  createManualReconciliationSafelyImpl = async () => ({
    status: 'created',
    reconciliation: { id: 'rec-1' },
  })
})

describe('POST /api/bank-transactions/[id]/reconcile', () => {
  it('returns 201 on successful reconciliation', async () => {
    const response = await POST({
      params: { id: 'bank-1' },
      request: buildRequest({ plannedTransactionId: crypto.randomUUID() }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(201)
    const data = (await response.json()) as { id: string }
    expect(data.id).toBe('rec-1')
  })

  it('returns deterministic 409 on bank transaction conflict', async () => {
    createManualReconciliationSafelyImpl = async () => ({
      status: 'bank_conflict',
      reconciliation: { id: 'existing-rec' },
    })

    const response = await POST({
      params: { id: 'bank-1' },
      request: buildRequest({ plannedTransactionId: crypto.randomUUID() }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(409)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('Diese Banktransaktion wurde bereits abgeglichen.')
  })

  it('returns deterministic 409 on planned transaction conflict', async () => {
    createManualReconciliationSafelyImpl = async () => ({
      status: 'planned_conflict',
      reconciliation: { id: 'existing-rec' },
    })

    const response = await POST({
      params: { id: 'bank-1' },
      request: buildRequest({ plannedTransactionId: crypto.randomUUID() }),
      locals: { user: { id: 'user-1' } },
    } as never)

    expect(response.status).toBe(409)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe(
      'Diese geplante Transaktion ist bereits mit einem Umsatz verknüpft.',
    )
  })
})
