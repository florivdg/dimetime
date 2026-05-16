import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { PUT, DELETE } = await import('./[id]')

const now = new Date('2026-03-09T00:00:00.000Z')
const planId = '11111111-1111-4111-8111-111111111111'
const otherPlanId = '22222222-2222-4222-8222-222222222222'
const archivedPlanId = '33333333-3333-4333-8333-333333333333'
const txId = '44444444-4444-4444-8444-444444444444'

async function seedPlans() {
  await testDb.insert(plansSchema.plan).values([
    {
      id: planId,
      date: '2026-03-01',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: otherPlanId,
      date: '2026-04-01',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: archivedPlanId,
      date: '2026-02-01',
      isArchived: true,
      createdAt: now,
      updatedAt: now,
    },
  ])
}

async function seedTx() {
  await testDb.insert(plansSchema.plannedTransaction).values({
    id: txId,
    name: 'T',
    type: 'expense',
    dueDate: '2026-03-15',
    amount: 1000,
    planId,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  harness.reset()
  await seedPlans()
})

afterAll(() => {
  harness.close()
})

describe('PUT /api/transactions/[id]', () => {
  it('returns 400 when id missing', async () => {
    const res = (await PUT(
      buildApiContext({ method: 'PUT', body: { name: 'X' } }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when transaction not found', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
        params: { id: '99999999-9999-4999-8999-999999999999' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 403 when plan is archived', async () => {
    await testDb.insert(plansSchema.plannedTransaction).values({
      id: txId,
      name: 'T',
      type: 'expense',
      dueDate: '2026-02-15',
      amount: 1000,
      planId: archivedPlanId,
      createdAt: now,
      updatedAt: now,
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
  it('returns 400 when id missing', async () => {
    const res = (await DELETE(
      buildApiContext({ method: 'DELETE' }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when not found', async () => {
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: '99999999-9999-4999-8999-999999999999' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

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
