import { describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itRejectsInvalidJson } from '@/lib/__fixtures__/route-guards'
import { seedPlan as seedPlanFixture } from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { GET, POST } = await import('./index')

async function seedPlan(id: string, date: string, isArchived = false) {
  await seedPlanFixture(testDb, { id, date, isArchived })
}

/** GET `/api/plans` (optionally at `url`) and return the listed plan ids. */
async function listPlanIds(url?: string): Promise<string[]> {
  const res = (await GET(
    buildApiContext(url ? { url } : {}) as never,
  )) as Response
  const body = await res.json()
  return body.plans.map((p: { id: string }) => p.id)
}

describe('GET /api/plans', () => {
  it('returns active plans by default', async () => {
    await seedPlan('p1', '2026-03-01')
    await seedPlan('p2', '2026-04-01', true)
    expect(await listPlanIds()).toEqual(['p1'])
  })

  it('includes archived when includeArchived=true', async () => {
    await seedPlan('p1', '2026-03-01')
    await seedPlan('p2', '2026-04-01', true)
    expect(
      await listPlanIds('http://test/api/plans?includeArchived=true'),
    ).toHaveLength(2)
  })

  it('filters by year', async () => {
    await seedPlan('p1', '2025-03-01')
    await seedPlan('p2', '2026-03-01')
    expect(await listPlanIds('http://test/api/plans?year=2026')).toEqual(['p2'])
  })

  it('treats year=all as no filter', async () => {
    await seedPlan('p1', '2025-01-01')
    await seedPlan('p2', '2026-01-01')
    expect(await listPlanIds('http://test/api/plans?year=all')).toHaveLength(2)
  })

  it('searches by name', async () => {
    await seedPlanFixture(testDb, {
      id: 'p1',
      name: 'Sommerurlaub',
      date: '2026-06-01',
      isArchived: false,
    })
    await seedPlan('p2', '2026-07-01')
    expect(await listPlanIds('http://test/api/plans?search=Sommer')).toEqual([
      'p1',
    ])
  })
})

describe('POST /api/plans', () => {
  itRejectsInvalidJson(POST)

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
