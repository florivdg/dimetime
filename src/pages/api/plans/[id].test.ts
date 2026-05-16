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
const planId = 'p1'

async function seedPlan() {
  await testDb.insert(plansSchema.plan).values({
    id: planId,
    name: 'X',
    date: '2026-03-01',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(() => {
  harness.reset()
})

afterAll(() => {
  harness.close()
})

describe('PUT /api/plans/[id]', () => {
  it('returns 400 when id missing', async () => {
    const res = (await PUT(
      buildApiContext({ method: 'PUT', body: { name: 'X' } }) as never,
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
    await seedPlan()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { date: '2026/03/01' },
        params: { id: planId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('updates and returns the plan', async () => {
    await seedPlan()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'Renamed' },
        params: { id: planId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Renamed')
  })
})

describe('DELETE /api/plans/[id]', () => {
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
        params: { id: 'missing' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('deletes and returns success', async () => {
    await seedPlan()
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: planId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
