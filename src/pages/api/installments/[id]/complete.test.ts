import { beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { plannedTransaction } from '@/db/schema/plans'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itGuardsIdRoute } from '@/lib/__fixtures__/route-guards'
import {
  seedInstallmentPlan,
  seedPlan,
  seedPlannedTransaction,
  seedUser,
} from '@/lib/__fixtures__/seeds'

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

const testDb = setupTestDb()

const { POST } = await import('./complete')

const userId = '11111111-1111-4111-8111-111111111111'
const installmentId = 'ip1'
const planId = 'plan-2026-03'

async function seedInstallment(completedAt: Date | null = null) {
  await seedPlan(testDb, { id: planId, date: '2026-03-01' })
  await seedInstallmentPlan(testDb, {
    id: installmentId,
    name: 'Sofa',
    amount: 5000,
    totalInstallments: 12,
    startMonth: '2026-03',
    completedAt,
    userId,
  })
  await seedPlannedTransaction(testDb, {
    id: 'row-open',
    name: 'Sofa',
    amount: 5000,
    dueDate: '2026-03-01',
    planId,
    installmentId,
  })
}

function complete(): Promise<Response> {
  return POST(
    buildApiContext({
      method: 'POST',
      params: { id: installmentId },
    }) as never,
  ) as Promise<Response>
}

beforeEach(async () => {
  await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
})

describe('POST /api/installments/[id]/complete', () => {
  itGuardsIdRoute(POST, {
    method: 'POST',
    unknownId: UNKNOWN_ID,
    notFoundName: 'returns 404 when installment not found',
  })

  it('completes the installment and removes its open rows', async () => {
    await seedInstallment()
    const res = await complete()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completedAt).not.toBeNull()

    const rows = await testDb
      .select()
      .from(plannedTransaction)
      .where(eq(plannedTransaction.installmentId, installmentId))
    expect(rows).toHaveLength(0)
  })

  it('returns 409 when the installment is already completed', async () => {
    await seedInstallment(new Date('2026-03-01T00:00:00.000Z'))
    const res = await complete()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Ratenzahlung ist bereits abgelöst')
  })

  it('returns 409 on the second call', async () => {
    await seedInstallment()
    expect((await complete()).status).toBe(200)
    expect((await complete()).status).toBe(409)
  })
})
