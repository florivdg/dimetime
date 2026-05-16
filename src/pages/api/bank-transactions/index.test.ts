import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { GET } = await import('./index')

const now = new Date('2026-03-09T00:00:00.000Z')

async function seed() {
  await testDb.insert(plansSchema.importSource).values({
    id: 'src-1',
    name: 'S',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
  await testDb.insert(plansSchema.bankTransaction).values({
    id: 'bt-1',
    sourceId: 'src-1',
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
})

afterAll(() => {
  harness.close()
})

describe('GET /api/bank-transactions', () => {
  it('returns empty when no rows', async () => {
    const res = (await GET(buildApiContext() as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toEqual([])
  })

  it('returns rows after seeding', async () => {
    await seed()
    const res = (await GET(buildApiContext() as never)) as Response
    const body = await res.json()
    expect(body.rows).toHaveLength(1)
  })

  it('rejects invalid query (status enum)', async () => {
    const res = (await GET(
      buildApiContext({
        url: 'http://test/api/bank-transactions?status=bogus',
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })
})
