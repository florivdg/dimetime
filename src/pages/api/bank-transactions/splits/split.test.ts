import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { POST, DELETE } = await import('../[id]/split')

const now = new Date('2026-03-09T00:00:00.000Z')
const sourceId = 'src-1'
const btId = 'bt-1'

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
  await testDb.insert(plansSchema.bankTransaction).values({
    id: btId,
    sourceId,
    dedupeKey: 'k1',
    bookingDate: '2026-03-01',
    amountCents: -2000,
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

describe('POST /api/bank-transactions/[id]/split', () => {
  it('returns 400 when id missing', async () => {
    const res = (await POST(
      buildApiContext({ method: 'POST', body: { splits: [] } }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when transaction not found', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { splits: [] },
        params: { id: 'missing' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 400 on invalid JSON', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        bodyText: '{bad',
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 400 for schema failure', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { splits: [{ amountCents: -100 }] },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 400 when split validation throws', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          splits: [{ amountCents: -1000 }, { amountCents: -2000 }],
        },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('splits successfully', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          splits: [{ amountCents: -1000 }, { amountCents: -1000 }],
        },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.splits).toHaveLength(2)
  })
})

describe('DELETE /api/bank-transactions/[id]/split', () => {
  it('returns 400 when id missing', async () => {
    const res = (await DELETE(
      buildApiContext({ method: 'DELETE' }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when transaction not found', async () => {
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: 'missing' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 400 when not currently split', async () => {
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('unsplits successfully', async () => {
    await POST(
      buildApiContext({
        method: 'POST',
        body: {
          splits: [{ amountCents: -1000 }, { amountCents: -1000 }],
        },
        params: { id: btId },
      }) as never,
    )
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
