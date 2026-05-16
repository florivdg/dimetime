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
const sourceId = 'src-1'

async function seedSource() {
  await testDb.insert(plansSchema.importSource).values({
    id: sourceId,
    name: 'Source',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'auto_month',
    isActive: true,
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

describe('PUT /api/import-sources/[id]', () => {
  it('returns 400 when id missing', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when not found', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
        params: { id: 'missing' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('rejects invalid body', async () => {
    await seedSource()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { preset: 'bogus' },
        params: { id: sourceId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('updates and returns the source', async () => {
    await seedSource()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'Renamed' },
        params: { id: sourceId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Renamed')
  })
})

describe('DELETE /api/import-sources/[id]', () => {
  it('returns 404 when not found', async () => {
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: 'missing' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 409 when bank transactions reference the source', async () => {
    await seedSource()
    await testDb.insert(plansSchema.bankTransaction).values({
      id: 'bt-1',
      sourceId,
      dedupeKey: 'k1',
      bookingDate: '2026-03-01',
      amountCents: -100,
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
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: sourceId },
      }) as never,
    )) as Response
    expect(res.status).toBe(409)
  })

  it('deletes successfully when not referenced', async () => {
    await seedSource()
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: sourceId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
