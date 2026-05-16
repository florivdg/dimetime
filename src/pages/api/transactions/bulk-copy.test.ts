import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as authSchema from '@/db/schema/auth'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { POST } = await import('./bulk-copy')

const now = new Date('2026-03-09T00:00:00.000Z')
const userId = '11111111-1111-4111-8111-111111111111'
const sourcePlanId = '22222222-2222-4222-8222-222222222222'
const targetPlanId = '33333333-3333-4333-8333-333333333333'
const archivedTargetId = '44444444-4444-4444-8444-444444444444'
const tx1 = '55555555-5555-4555-8555-555555555555'
const tx2 = '66666666-6666-4666-8666-666666666666'

async function seed() {
  await testDb.insert(authSchema.user).values({
    id: userId,
    name: 'A',
    email: 'a@example.com',
    createdAt: now,
    updatedAt: now,
  })
  await testDb.insert(plansSchema.plan).values([
    {
      id: sourcePlanId,
      date: '2026-01-31',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: targetPlanId,
      date: '2026-02-01',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: archivedTargetId,
      date: '2026-02-15',
      isArchived: true,
      createdAt: now,
      updatedAt: now,
    },
  ])
  await testDb.insert(plansSchema.plannedTransaction).values([
    {
      id: tx1,
      name: 'A',
      type: 'expense',
      dueDate: '2026-01-31',
      amount: 100,
      planId: sourcePlanId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: tx2,
      name: 'B',
      type: 'income',
      dueDate: '2026-01-15',
      amount: 200,
      planId: sourcePlanId,
      createdAt: now,
      updatedAt: now,
    },
  ])
}

beforeEach(async () => {
  harness.reset()
  await seed()
})

afterAll(() => {
  harness.close()
})

describe('POST /api/transactions/bulk-copy', () => {
  it('returns 401 when no user', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { targetPlanId, transactionIds: [tx1] },
      }) as never,
    )) as Response
    expect(res.status).toBe(401)
  })

  it('rejects missing fields', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {},
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when target plan does not exist', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          targetPlanId: '99999999-9999-4999-8999-999999999999',
          transactionIds: [tx1],
        },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 400 when target plan archived', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { targetPlanId: archivedTargetId, transactionIds: [tx1] },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when some transactions not found', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          targetPlanId,
          transactionIds: [tx1, '99999999-9999-4999-8999-999999999999'],
        },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('copies transactions and clamps dueDate to target month', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { targetPlanId, transactionIds: [tx1] },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.count).toBe(1)

    const copied = await testDb.query.plannedTransaction.findMany({
      where: (t, { eq: e }) => e(t.planId, targetPlanId),
    })
    expect(copied).toHaveLength(1)
    expect(copied[0].dueDate).toBe('2026-02-28') // clamped from Jan 31 -> Feb 28
  })

  it('deduplicates transaction ids', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { targetPlanId, transactionIds: [tx1, tx1, tx2] },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.count).toBe(2)
  })
})
