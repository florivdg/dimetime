import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { POST } = await import('./seed')

const now = new Date('2026-03-09T00:00:00.000Z')

beforeEach(() => {
  harness.reset()
})

afterAll(() => {
  harness.close()
})

describe('POST /api/categories/seed', () => {
  it('inserts all defaults when no categories exist', async () => {
    const res = (await POST(
      buildApiContext({ method: 'POST' }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inserted).toBeGreaterThan(0)
    expect(body.skipped).toBe(0)
    const cats = await testDb.query.category.findMany({})
    expect(cats.length).toBe(body.inserted)
  })

  it('skips existing slugs and reports them', async () => {
    await testDb.insert(plansSchema.category).values({
      id: 'pre',
      name: 'Miete',
      slug: 'miete',
      createdAt: now,
      updatedAt: now,
    })
    const res = (await POST(
      buildApiContext({ method: 'POST' }) as never,
    )) as Response
    const body = await res.json()
    expect(body.skipped).toBeGreaterThanOrEqual(1)
  })
})
