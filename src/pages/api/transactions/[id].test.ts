import { beforeEach, describe, expect, it } from 'bun:test'
import { seedPlan, seedPlannedTransaction } from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itGuardsIdRoute } from '@/lib/__fixtures__/route-guards'

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

const testDb = setupTestDb()

const { PUT, DELETE } = await import('./[id]')

const planId = '11111111-1111-4111-8111-111111111111'
const otherPlanId = '22222222-2222-4222-8222-222222222222'
const archivedPlanId = '33333333-3333-4333-8333-333333333333'
const txId = '44444444-4444-4444-8444-444444444444'

async function seedPlans() {
  await seedPlan(testDb, { id: planId, date: '2026-03-01', isArchived: false })
  await seedPlan(testDb, {
    id: otherPlanId,
    date: '2026-04-01',
    isArchived: false,
  })
  await seedPlan(testDb, {
    id: archivedPlanId,
    date: '2026-02-01',
    isArchived: true,
  })
}

async function seedTx() {
  await seedPlannedTransaction(testDb, {
    id: txId,
    name: 'T',
    type: 'expense',
    dueDate: '2026-03-15',
    amount: 1000,
    planId,
  })
}

beforeEach(async () => {
  await seedPlans()
})

describe('PUT /api/transactions/[id]', () => {
  itGuardsIdRoute(PUT, {
    method: 'PUT',
    body: { name: 'X' },
    unknownId: UNKNOWN_ID,
    notFoundName: 'returns 404 when transaction not found',
  })

  it('returns 403 when plan is archived', async () => {
    await seedPlannedTransaction(testDb, {
      id: txId,
      name: 'T',
      type: 'expense',
      dueDate: '2026-02-15',
      amount: 1000,
      planId: archivedPlanId,
    })
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })

  it('rejects invalid body', async () => {
    await seedTx()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { dueDate: '2026/03/01' },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects move to same plan', async () => {
    await seedTx()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { planId },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects move to archived plan', async () => {
    await seedTx()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { planId: archivedPlanId },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(403)
  })

  it('updates and returns the transaction', async () => {
    await seedTx()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'Renamed' },
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/transactions/[id]', () => {
  itGuardsIdRoute(DELETE, { method: 'DELETE', unknownId: UNKNOWN_ID })

  it('deletes when plan active', async () => {
    await seedTx()
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: txId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
