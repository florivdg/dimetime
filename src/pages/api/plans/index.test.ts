import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { GET, POST } = await import('./index')

const now = new Date('2026-03-09T00:00:00.000Z')

async function seedPlan(id: string, date: string, isArchived = false) {
  await testDb.insert(plansSchema.plan).values({
    id,
    date,
    isArchived,
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

describe('GET /api/plans', () => {
  it('returns active plans by default', async () => {
    await seedPlan('p1', '2026-03-01')
    await seedPlan('p2', '2026-04-01', true)
    const res = (await GET(buildApiContext() as never)) as Response
    const body = await res.json()
    expect(body.plans.map((p: { id: string }) => p.id)).toEqual(['p1'])
  })

  it('includes archived when includeArchived=true', async () => {
    await seedPlan('p1', '2026-03-01')
    await seedPlan('p2', '2026-04-01', true)
    const res = (await GET(
      buildApiContext({
        url: 'http://test/api/plans?includeArchived=true',
      }) as never,
    )) as Response
    const body = await res.json()
    expect(body.plans).toHaveLength(2)
  })

  it('filters by year', async () => {
    await seedPlan('p1', '2025-03-01')
    await seedPlan('p2', '2026-03-01')
    const res = (await GET(
      buildApiContext({ url: 'http://test/api/plans?year=2026' }) as never,
    )) as Response
    const body = await res.json()
    expect(body.plans.map((p: { id: string }) => p.id)).toEqual(['p2'])
  })

  it('treats year=all as no filter', async () => {
    await seedPlan('p1', '2025-01-01')
    await seedPlan('p2', '2026-01-01')
    const res = (await GET(
      buildApiContext({ url: 'http://test/api/plans?year=all' }) as never,
    )) as Response
    const body = await res.json()
    expect(body.plans).toHaveLength(2)
  })

  it('searches by name', async () => {
    await testDb.insert(plansSchema.plan).values({
      id: 'p1',
      name: 'Sommerurlaub',
      date: '2026-06-01',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })
    await seedPlan('p2', '2026-07-01')
    const res = (await GET(
      buildApiContext({ url: 'http://test/api/plans?search=Sommer' }) as never,
    )) as Response
    const body = await res.json()
    expect(body.plans.map((p: { id: string }) => p.id)).toEqual(['p1'])
  })
})

describe('POST /api/plans', () => {
  it('rejects invalid JSON', async () => {
    const res = (await POST(
      buildApiContext({ method: 'POST', bodyText: '{bad' }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects missing date', async () => {
    const res = (await POST(
      buildApiContext({ method: 'POST', body: {} }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects invalid date format', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { date: '2026/03/01' },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('creates and returns 201', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { date: '2026-03-01', name: 'March' },
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('March')
  })
})
