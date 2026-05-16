import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { POST } = await import('./bulk-assign-plan')

const now = new Date('2026-03-09T00:00:00.000Z')
const planId = '11111111-1111-4111-8111-111111111111'
const archivedPlanId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'
const btId = '44444444-4444-4444-8444-444444444444'

async function seed() {
  await testDb.insert(plansSchema.importSource).values({
    id: sourceId,
    name: 'S',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
  await testDb.insert(plansSchema.plan).values([
    {
      id: planId,
      date: '2026-03-01',
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
  await testDb.insert(plansSchema.bankTransaction).values({
    id: btId,
    sourceId,
    dedupeKey: 'k1',
    bookingDate: '2026-03-01',
    amountCents: -1000,
    currency: 'EUR',
    status: 'booked',
    rawDataJson: '{}',
    isArchived: false,
    isSplit: false,
    importSeenCount: 1,
    planAssignment: 'none',
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  harness.reset()
  await seed()
})

afterAll(() => {
  harness.close()
})

describe('POST /api/bank-transactions/bulk-assign-plan', () => {
  it('rejects invalid JSON', async () => {
    const res = (await POST(
      buildApiContext({ method: 'POST', bodyText: '{bad' }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects empty ids/splitIds', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId, ids: [], splitIds: [] },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when target plan missing', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          planId: '99999999-9999-4999-8999-999999999999',
          ids: [btId],
        },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 400 when target plan archived', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId: archivedPlanId, ids: [btId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('assigns plan and returns count', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId, ids: [btId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(1)
  })

  it('accepts null planId (unassign)', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId: null, ids: [btId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
